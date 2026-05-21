import HeroSlide from "../models/heroSlide.model.js";
import Purpose from "../models/purpose.model.js";
import Rashi from "../models/rashi.model.js";
import Collection from "../models/collection.model.js";
import Festival from "../models/festival.model.js";
import BlogPost from "../models/blogPost.model.js";
import FeaturedBundle from "../models/featuredBundle.model.js";
import Product from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// ─── Helper to generate CRUD for any model ───────────────────────────────────
function makeCRUD(Model, name) {
  const list = asyncHandler(async (req, res) => {
    const items = await Model.find().sort({ order: 1, createdAt: -1 });
    res.json(new ApiResponse(200, items, `${name} fetched`));
  });

  const create = asyncHandler(async (req, res) => {
    const item = await Model.create(req.body);
    res.status(201).json(new ApiResponse(201, item, `${name} created`));
  });

  const update = asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json(new ApiResponse(404, null, `${name} not found`));
    res.json(new ApiResponse(200, item, `${name} updated`));
  });

  const remove = asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json(new ApiResponse(404, null, `${name} not found`));
    res.json(new ApiResponse(200, null, `${name} deleted`));
  });

  return { list, create, update, remove };
}

// ─── Hero Slides ──────────────────────────────────────────────────────────────
export const {
  list: listHeroSlides,
  create: createHeroSlide,
  update: updateHeroSlide,
  remove: deleteHeroSlide,
} = makeCRUD(HeroSlide, "Hero Slide");

// ─── Purposes ─────────────────────────────────────────────────────────────────
export const {
  list: listPurposes,
  create: createPurpose,
  update: updatePurpose,
  remove: deletePurpose,
} = makeCRUD(Purpose, "Purpose");

// ─── Rashis ───────────────────────────────────────────────────────────────────
export const {
  list: listRashis,
  create: createRashi,
  update: updateRashi,
  remove: deleteRashi,
} = makeCRUD(Rashi, "Rashi");

// ─── Collections ──────────────────────────────────────────────────────────────
export const {
  list: listCollections,
  create: createCollection,
  update: updateCollection,
  remove: deleteCollection,
} = makeCRUD(Collection, "Collection");

// ─── Festivals ────────────────────────────────────────────────────────────────
export const {
  list: listFestivals,
  create: createFestival,
  update: updateFestival,
  remove: deleteFestival,
} = makeCRUD(Festival, "Festival");

// ─── Blog Posts ───────────────────────────────────────────────────────────────
export const {
  list: listBlogPosts,
  create: createBlogPost,
  update: updateBlogPost,
  remove: deleteBlogPost,
} = makeCRUD(BlogPost, "Blog Post");

// ─── Featured Bundle ──────────────────────────────────────────────────────────
export const {
  list: listFeaturedBundles,
  create: createFeaturedBundle,
  update: updateFeaturedBundle,
  remove: deleteFeaturedBundle,
} = makeCRUD(FeaturedBundle, "Featured Bundle");

// ─── Flash Deals ──────────────────────────────────────────────────────────────
export const listFlashDeals = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFlashDeal: true })
    .select("name image price originalPrice flashDealDiscount flashDealEndsAt isFlashDeal isActive stockStatus")
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, products, "Flash deals fetched"));
});

export const updateFlashDeal = asyncHandler(async (req, res) => {
  const { flashDealDiscount, flashDealEndsAt, isFlashDeal } = req.body;
  const update = {};
  if (flashDealDiscount !== undefined) update.flashDealDiscount = Number(flashDealDiscount);
  if (flashDealEndsAt !== undefined) update.flashDealEndsAt = flashDealEndsAt ? new Date(flashDealEndsAt) : null;
  if (isFlashDeal !== undefined) update.isFlashDeal = isFlashDeal;

  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true })
    .select("name image price originalPrice flashDealDiscount flashDealEndsAt isFlashDeal isActive stockStatus");
  if (!product) return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  res.json(new ApiResponse(200, product, "Flash deal updated"));
});
