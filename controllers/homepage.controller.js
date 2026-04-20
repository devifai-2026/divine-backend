import Product from "../models/product.model.js";
import HeroSlide from "../models/heroSlide.model.js";
import Purpose from "../models/purpose.model.js";
import Rashi from "../models/rashi.model.js";
import Collection from "../models/collection.model.js";
import Festival from "../models/festival.model.js";
import BlogPost from "../models/blogPost.model.js";
import FeaturedBundle from "../models/featuredBundle.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

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
  ] = await Promise.all([
    HeroSlide.find({ isActive: true }).sort({ order: 1 }),
    Product.find({
      isActive: true,
      isFlashDeal: true,
      $or: [{ flashDealEndsAt: { $gt: now } }, { flashDealEndsAt: null }, { flashDealEndsAt: { $exists: false } }],
    })
      .select("name image price originalPrice flashDealDiscount flashDealEndsAt stockStatus stock rating reviewCount benefit")
      .limit(6),
    Collection.find({ isActive: true }).sort({ order: 1 }),
    Purpose.find({ isActive: true }).sort({ order: 1 }),
    Rashi.find({ isActive: true }).sort({ order: 1 }),
    Product.find({ isActive: true, isFreshArrival: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller")
      .sort({ createdAt: -1 })
      .limit(8),
    Product.find({ isActive: true, isTrending: true })
      .select("name image price originalPrice rating reviewCount benefit energyLevel isEnergized material size stockStatus isTrending isBestseller")
      .limit(8),
    Festival.find({ isActive: true }),
    BlogPost.find({ isActive: true }).limit(6),
    FeaturedBundle.findOne({ isActive: true }),
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
      },
      "Homepage data fetched successfully"
    )
  );
});
