import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import BlogPost from "../models/blogPost.model.js";
import Redirect from "../models/redirect.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateProductSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  schemaToScriptTag,
} from "../utils/jsonld.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://www.crystaura.in";

const DEFAULT_META = {
  title: "Crystaura — Sacred Spiritual Products",
  description:
    "Discover authentic spiritual products — crystals, rudraksha, yantras, and sacred items energized with Vedic rituals.",
  image: `${BASE_URL}/og-default.jpg`,
};

// ─── Sitemap ────────────────────────────────────────────────────────────────

export const getSitemap = asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const [products, categories, blogPosts] = await Promise.all([
    Product.find({ isActive: true, slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .lean(),
    Category.find({ isActive: true }).select("id updatedAt").lean(),
    BlogPost.find({ isActive: true, slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .lean(),
  ]);

  const staticPages = [
    { loc: BASE_URL, lastmod: today, changefreq: "daily", priority: "1.0" },
    { loc: `${BASE_URL}/shop`, lastmod: today, changefreq: "daily", priority: "0.9" },
    { loc: `${BASE_URL}/privacy-policy`, lastmod: today, changefreq: "yearly", priority: "0.3" },
    { loc: `${BASE_URL}/terms`, lastmod: today, changefreq: "yearly", priority: "0.3" },
  ];

  const productUrls = products.map((p) => ({
    loc: `${BASE_URL}/product/${p.slug}`,
    lastmod: new Date(p.updatedAt).toISOString().split("T")[0],
    changefreq: "weekly",
    priority: "0.8",
  }));

  const categoryUrls = categories.map((c) => ({
    loc: `${BASE_URL}/shop?category=${encodeURIComponent(c.id)}`,
    lastmod: new Date(c.updatedAt).toISOString().split("T")[0],
    changefreq: "weekly",
    priority: "0.7",
  }));

  const blogUrls = blogPosts.map((p) => ({
    loc: `${BASE_URL}/blog/${p.slug}`,
    lastmod: new Date(p.updatedAt).toISOString().split("T")[0],
    changefreq: "monthly",
    priority: "0.6",
  }));

  const allUrls = [...staticPages, ...productUrls, ...categoryUrls, ...blogUrls];

  const urlXml = allUrls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlXml}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(xml);
});

// ─── robots.txt ─────────────────────────────────────────────────────────────

export const getRobots = (_req, res) => {
  const robots = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /orders
Disallow: /addresses
Disallow: /reset-password

Sitemap: ${BASE_URL}/sitemap.xml
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(robots);
};

// ─── SEO Meta API (JSON — used by frontend React Helmet) ────────────────────

export const getSeoMeta = asyncHandler(async (req, res) => {
  const pagePath = (req.query.path || "/").toString();

  // Product page
  if (pagePath.startsWith("/product/")) {
    const slug = pagePath.slice("/product/".length);
    const product = await Product.findOne({ slug, isActive: true }).lean();

    if (!product) {
      return res.status(404).json(new ApiResponse(404, null, "No meta found for this path"));
    }

    const title = product.meta_title || `${product.name} | Crystaura`;
    const description =
      product.meta_description || product.description?.slice(0, 160) || DEFAULT_META.description;
    const image = product.og_image || product.image || DEFAULT_META.image;
    const canonical = product.canonical_url || `${BASE_URL}/product/${product.slug}`;

    const breadcrumb = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      { name: product.category, path: `/shop?category=${encodeURIComponent(product.category)}` },
      { name: product.name, path: `/product/${product.slug}` },
    ]);

    return res.json(
      new ApiResponse(
        200,
        {
          title,
          description,
          canonical,
          og: {
            title: product.og_title || title,
            description: product.og_description || description,
            image,
            url: canonical,
            type: "product",
          },
          jsonLd: [generateProductSchema(product), breadcrumb],
        },
        "Meta fetched",
      ),
    );
  }

  // Blog post page
  if (pagePath.startsWith("/blog/")) {
    const slug = pagePath.slice("/blog/".length);
    const post = await BlogPost.findOne({ slug, isActive: true }).lean();

    if (!post) {
      return res.status(404).json(new ApiResponse(404, null, "No meta found for this path"));
    }

    const title = post.meta_title || `${post.title} | Crystaura Blog`;
    const description = post.meta_description || post.excerpt?.slice(0, 160) || DEFAULT_META.description;
    const image = post.og_image || post.image || DEFAULT_META.image;
    const canonical = post.canonical_url || `${BASE_URL}/blog/${post.slug}`;

    const breadcrumb = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]);

    return res.json(
      new ApiResponse(
        200,
        {
          title,
          description,
          canonical,
          og: {
            title: post.og_title || title,
            description: post.og_description || description,
            image,
            url: canonical,
            type: "article",
          },
          jsonLd: [generateArticleSchema(post), breadcrumb],
        },
        "Meta fetched",
      ),
    );
  }

  // Default / static pages
  const staticMeta = {
    "/": {
      title: "Crystaura — Sacred Spiritual Products",
      description: "Discover authentic crystals, rudraksha, yantras & sacred items energized with Vedic rituals.",
    },
    "/shop": {
      title: "Shop Spiritual Products | Crystaura",
      description: "Browse our full collection of spiritual products — crystals, malas, yantras, and more.",
    },
    "/privacy-policy": { title: "Privacy Policy | Crystaura", description: DEFAULT_META.description },
    "/terms": { title: "Terms & Conditions | Crystaura", description: DEFAULT_META.description },
  };

  const meta = staticMeta[pagePath] || {
    title: DEFAULT_META.title,
    description: DEFAULT_META.description,
  };

  return res.json(
    new ApiResponse(
      200,
      {
        title: meta.title,
        description: meta.description,
        canonical: `${BASE_URL}${pagePath}`,
        og: {
          title: meta.title,
          description: meta.description,
          image: DEFAULT_META.image,
          url: `${BASE_URL}${pagePath}`,
          type: "website",
        },
        jsonLd: null,
      },
      "Meta fetched",
    ),
  );
});

// ─── Server-side HTML meta injection (production only) ───────────────────────
// Reads the built index.html, injects dynamic <head> tags, serves modified HTML.

let _indexHtmlCache = null;

function readIndexHtml() {
  if (_indexHtmlCache) return _indexHtmlCache;
  const distPath = path.resolve(__dirname, "../../divine-shop/dist/index.html");
  if (!fs.existsSync(distPath)) return null;
  _indexHtmlCache = fs.readFileSync(distPath, "utf-8");
  return _indexHtmlCache;
}

function buildMetaTags({ title, description, canonical, og, jsonLd }) {
  const schemas = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return `<title>${title}</title>
    <meta name="description" content="${description.replace(/"/g, "&quot;")}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${(og.title || title).replace(/"/g, "&quot;")}">
    <meta property="og:description" content="${(og.description || description).replace(/"/g, "&quot;")}">
    <meta property="og:image" content="${og.image || DEFAULT_META.image}">
    <meta property="og:url" content="${og.url || canonical}">
    <meta property="og:type" content="${og.type || "website"}">
    <meta property="og:site_name" content="Crystaura">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${(og.title || title).replace(/"/g, "&quot;")}">
    <meta name="twitter:description" content="${(og.description || description).replace(/"/g, "&quot;")}">
    <meta name="twitter:image" content="${og.image || DEFAULT_META.image}">
    ${schemas.map((s) => schemaToScriptTag(s)).join("\n    ")}`;
}

export const serveWithMeta = asyncHandler(async (req, res) => {
  const template = readIndexHtml();
  if (!template) {
    return res.status(503).json({ message: "Frontend build not found. Run npm run build in divine-shop." });
  }

  // Resolve meta for this route
  let metaPayload = {
    title: DEFAULT_META.title,
    description: DEFAULT_META.description,
    canonical: `${BASE_URL}${req.path}`,
    og: {
      title: DEFAULT_META.title,
      description: DEFAULT_META.description,
      image: DEFAULT_META.image,
      url: `${BASE_URL}${req.path}`,
      type: "website",
    },
    jsonLd: null,
  };

  try {
    if (req.path.startsWith("/product/")) {
      const slug = req.path.slice("/product/".length);
      const product = await Product.findOne({ slug, isActive: true }).lean();

      if (product) {
        const title = product.meta_title || `${product.name} | Crystaura`;
        const description =
          product.meta_description || product.description?.slice(0, 160) || DEFAULT_META.description;
        const image = product.og_image || product.image || DEFAULT_META.image;
        const canonical = product.canonical_url || `${BASE_URL}/product/${product.slug}`;

        metaPayload = {
          title,
          description,
          canonical,
          og: {
            title: product.og_title || title,
            description: product.og_description || description,
            image,
            url: canonical,
            type: "product",
          },
          jsonLd: [
            generateProductSchema(product),
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Shop", path: "/shop" },
              { name: product.category, path: `/shop?category=${encodeURIComponent(product.category)}` },
              { name: product.name, path: `/product/${product.slug}` },
            ]),
          ],
        };
      } else {
        // Product not found — check redirects
        const redirect = await Redirect.findOne({ from: req.path });
        if (redirect) {
          return res.redirect(redirect.statusCode, redirect.to);
        }
        // Serve SPA with 404 status so React can display error page
        const html = template.replace("<!-- __META__ -->", buildMetaTags(metaPayload));
        return res.status(404).send(html);
      }
    } else if (req.path.startsWith("/blog/")) {
      const slug = req.path.slice("/blog/".length);
      const post = await BlogPost.findOne({ slug, isActive: true }).lean();

      if (post) {
        const title = post.meta_title || `${post.title} | Crystaura Blog`;
        const description = post.meta_description || post.excerpt?.slice(0, 160) || DEFAULT_META.description;
        const image = post.og_image || post.image || DEFAULT_META.image;
        const canonical = post.canonical_url || `${BASE_URL}/blog/${post.slug}`;

        metaPayload = {
          title,
          description,
          canonical,
          og: {
            title: post.og_title || title,
            description: post.og_description || description,
            image,
            url: canonical,
            type: "article",
          },
          jsonLd: [
            generateArticleSchema(post),
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Blog", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ],
        };
      }
    }
  } catch {
    // Fall through with default meta on error — never crash the page
  }

  // Check top-level redirects (for any path)
  const redirect = await Redirect.findOne({ from: req.path.toLowerCase() });
  if (redirect) {
    return res.redirect(redirect.statusCode, redirect.to);
  }

  const html = template.replace("<!-- __META__ -->", buildMetaTags(metaPayload));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
});

// ─── Redirect CRUD (Admin) ────────────────────────────────────────────────────

export const getRedirects = asyncHandler(async (_req, res) => {
  const redirects = await Redirect.find().sort({ createdAt: -1 }).lean();
  return res.json(new ApiResponse(200, { redirects }, "Redirects fetched"));
});

export const createRedirect = asyncHandler(async (req, res) => {
  const { from, to, statusCode = 301, reason } = req.body;
  if (!from || !to) {
    return res.status(400).json(new ApiResponse(400, null, "`from` and `to` are required"));
  }

  const redirect = await Redirect.findOneAndUpdate(
    { from: from.toLowerCase() },
    { from: from.toLowerCase(), to, statusCode, reason: reason || "" },
    { upsert: true, new: true },
  );

  return res.status(201).json(new ApiResponse(201, { redirect }, "Redirect saved"));
});

export const deleteRedirect = asyncHandler(async (req, res) => {
  const redirect = await Redirect.findByIdAndDelete(req.params.id);
  if (!redirect) {
    return res.status(404).json(new ApiResponse(404, null, "Redirect not found"));
  }
  return res.json(new ApiResponse(200, null, "Redirect deleted"));
});
