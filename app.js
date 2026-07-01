import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import userRoutes from "./routes/user.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import subCategoryRoutes from "./routes/subcategory.routes.js";
import homepageRoutes from "./routes/homepage.routes.js";
import shippingRoutes from "./routes/shipping.routes.js";
import seoRoutes from "./routes/seo.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import { getPublicShipping } from "./controllers/settings.controller.js";
import { serveWithMeta } from "./controllers/seo.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

// ─── Maintenance mode ────────────────────────────────────────────────────────
// Set MAINTENANCE=true in .env to return 503 to all non-API routes.
const MAINTENANCE = process.env.MAINTENANCE === "true";

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://sanatan-admin.netlify.app",
  "https://admin.crystaura.in",
  "https://crystaura.in",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://www.crystaura.in",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.options("/{*path}", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// ─── SEO endpoints (sitemap, robots, meta API, redirects) ────────────────────
// Must be registered BEFORE API routes so /sitemap.xml and /robots.txt resolve first.
app.use("/", seoRoutes);

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api/homepage", homepageRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/blogs", blogRoutes);
app.get("/api/settings/shipping", getPublicShipping);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// API root info
app.get("/api", (_req, res) => {
  res.json({
    message: "Welcome to Crystaura API",
    version: "1.0.0",
    status: "active",
    timestamp: new Date().toISOString(),
  });
});

// ─── Production SPA serving with server-side meta injection ──────────────────
// In production the Express server serves the built React app.
// For every non-API, non-asset route, it reads dist/index.html, injects
// dynamic <meta> / JSON-LD tags for that URL, then sends the modified HTML.
// This ensures crawlers and WhatsApp/Facebook link previews see real meta tags.

const isProduction = process.env.NODE_ENV === "production";
const distPath = path.resolve(__dirname, "../divine-shop/dist");

if (isProduction) {
  // Serve static assets from Vite build output
  app.use(express.static(distPath, { index: false }));

  // Maintenance mode: return 503 for all page routes
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    if (MAINTENANCE) {
      return res.status(503).send(
        `<!doctype html><html><head><title>Maintenance | Crystaura</title></head>
<body><h1>We'll be back shortly.</h1>
<p>Crystaura is undergoing scheduled maintenance. Please check back in a few minutes.</p></body></html>`,
      );
    }
    return next();
  });

  // All page routes → serve index.html with injected meta tags
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return serveWithMeta(req, res, next);
  });
}

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
  });
});

export { server };
export default app;
