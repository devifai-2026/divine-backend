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
  const [
    heroSlides,
    flashDeals,
    collections,
    purposes,
    rashis,
    braceletCollection,
    trending,
    pyramidCollection,
    domTreeCollection,
    festivals,
    blogPosts,
    featuredBundle,
    curatedCategories,
  ] = await Promise.all([
    HeroSlide.find({ isActive: true }).sort({ order: 1 }),
    Product.find({ isActive: true, isFlashDeal: true })
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
    // Bracelet Collection: products tagged isBraceletCollection from admin Premium Configuration
    Product.find({ isActive: true, isBraceletCollection: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller isBraceletCollection")
      .sort({ createdAt: -1 })
      .limit(8),
    // Trending Artifacts: prefer isTrending-flagged products, fall back to top-rated
    Product.aggregate([
      { $match: { isActive: true } },
      { $addFields: { _trendScore: { $cond: [{ $eq: ["$isTrending", true] }, 1, 0] } } },
      { $sort: { _trendScore: -1, rating: -1, reviewCount: -1 } },
      { $limit: 4 },
      { $project: PRODUCT_PROJECT },
    ]),
    // Crystora Pyramid Collection: isPyramidCollection-flagged products
    Product.find({ isActive: true, isPyramidCollection: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller")
      .sort({ createdAt: -1 })
      .limit(8),
    // Crystora Dom Tree Collection: isDomTreeCollection-flagged products
    Product.find({ isActive: true, isDomTreeCollection: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller")
      .sort({ createdAt: -1 })
      .limit(8),
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
        braceletCollection,
        trending,
        pyramidCollection,
        domTreeCollection,
        festivals,
        blogPosts,
        featuredBundle,
        curatedCategories,
      },
      "Homepage data fetched successfully"
    )
  );
});
