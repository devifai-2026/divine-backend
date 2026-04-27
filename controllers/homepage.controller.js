import Product from "../models/product.model.js";
import HeroSlide from "../models/heroSlide.model.js";
import Purpose from "../models/purpose.model.js";
import Rashi from "../models/rashi.model.js";
import Category from "../models/category.model.js";
import Festival from "../models/festival.model.js";
import BlogPost from "../models/blogPost.model.js";
import FeaturedBundle from "../models/featuredBundle.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const PRODUCT_PROJECT = {
  name: 1, image: 1, price: 1, originalPrice: 1,
  rating: 1, reviewCount: 1, benefit: 1, energyLevel: 1,
  isEnergized: 1, material: 1, size: 1, stockStatus: 1,
  isTrending: 1, isBestseller: 1,
};

// GET /api/homepage
export const getHomepage = asyncHandler(async (req, res) => {
  const now = new Date();

  const [
    heroSlides,
    flashDeals,
    collections,
    purposes,
    rashis,
    freshArrivals,
    trending,
    festivals,
    blogPosts,
    featuredBundle,
    curatedCategories,
  ] = await Promise.all([
    HeroSlide.find({ isActive: true }).sort({ order: 1 }),
    Product.find({
      isActive: true,
      isFlashDeal: true,
      $or: [{ flashDealEndsAt: { $gt: now } }, { flashDealEndsAt: null }, { flashDealEndsAt: { $exists: false } }],
    })
      .select("name image price originalPrice flashDealDiscount flashDealEndsAt stockStatus stock rating reviewCount benefit")
      .limit(6),
    // Divine Collections: 6 random active products, changes on every load
    Product.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 6 } },
      { $project: PRODUCT_PROJECT },
    ]),
    Purpose.find({ isActive: true }).sort({ order: 1 }),
    Rashi.find({ isActive: true }).sort({ order: 1 }),
    // Fresh Arrivals: latest 4 added to the DB, no flag required
    Product.find({ isActive: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller")
      .sort({ createdAt: -1 })
      .limit(4),
    // Trending Artifacts: prefer isTrending-flagged products, fall back to top-rated
    Product.aggregate([
      { $match: { isActive: true } },
      { $addFields: { _trendScore: { $cond: [{ $eq: ["$isTrending", true] }, 1, 0] } } },
      { $sort: { _trendScore: -1, rating: -1, reviewCount: -1 } },
      { $limit: 4 },
      { $project: PRODUCT_PROJECT },
    ]),
    Festival.find({ isActive: true }),
    BlogPost.find({ isActive: true }).limit(6),
    FeaturedBundle.findOne({ isActive: true }),
    // Masterfully Curated: 6 random categories with their subcategories
    Category.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 6 } },
    ]),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        heroSlides,
        flashDeals,
        collections,
        purposes,
        rashis,
        freshArrivals,
        trending,
        festivals,
        blogPosts,
        featuredBundle,
        curatedCategories,
      },
      "Homepage data fetched successfully"
    )
  );
});
