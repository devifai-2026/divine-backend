import { Router } from "express";
import {
  getStats,
  getAnalytics,
  getAllProducts,
  exportProducts,
  bulkProductOps,
  getAllOrders,
  bulkOrderStatus,
  getAllUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  getAllReviews,
  deleteReview,
} from "../controllers/admin.controller.js";
import { getAdminShipmentStatus, adminTrackByAwb, cancelShipment } from "../controllers/shipping.controller.js";
import { getSettings, updateShiprocketSettings, updateShippingSettings } from "../controllers/settings.controller.js";
import {
  listHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
  listPurposes, createPurpose, updatePurpose, deletePurpose,
  listRashis, createRashi, updateRashi, deleteRashi,
  listCollections, createCollection, updateCollection, deleteCollection,
  listFestivals, createFestival, updateFestival, deleteFestival,
  listBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  listFeaturedBundles, createFeaturedBundle, updateFeaturedBundle, deleteFeaturedBundle,
  listFlashDeals, updateFlashDeal,
} from "../controllers/adminHomepage.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();
router.use(verifyJWT, isAdmin);

// Stats
router.get("/stats", getStats);

// Analytics
router.get("/analytics", getAnalytics);

// Products
router.get("/products", getAllProducts);
router.get("/products/export", exportProducts);
router.post("/products/bulk", bulkProductOps);

// Orders
router.get("/orders", getAllOrders);
router.patch("/orders/bulk-status", bulkOrderStatus);
// Literal route must come before /:orderId/track to avoid param collision
router.get("/orders/track-awb/:awb", adminTrackByAwb);
router.get("/orders/:orderId/track", getAdminShipmentStatus);
router.post("/orders/:orderId/cancel-shipment", cancelShipment);

// Users
router.get("/users", getAllUsers);
router.get("/users/:id", getUserDetail);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Reviews
router.get("/reviews", getAllReviews);
router.delete("/reviews/:productId/:reviewId", deleteReview);

// ─── Homepage Management ──────────────────────────────────────────────────────
router.get("/homepage/hero-slides", listHeroSlides);
router.post("/homepage/hero-slides", createHeroSlide);
router.patch("/homepage/hero-slides/:id", updateHeroSlide);
router.delete("/homepage/hero-slides/:id", deleteHeroSlide);

router.get("/homepage/purposes", listPurposes);
router.post("/homepage/purposes", createPurpose);
router.patch("/homepage/purposes/:id", updatePurpose);
router.delete("/homepage/purposes/:id", deletePurpose);

router.get("/homepage/rashis", listRashis);
router.post("/homepage/rashis", createRashi);
router.patch("/homepage/rashis/:id", updateRashi);
router.delete("/homepage/rashis/:id", deleteRashi);

router.get("/homepage/collections", listCollections);
router.post("/homepage/collections", createCollection);
router.patch("/homepage/collections/:id", updateCollection);
router.delete("/homepage/collections/:id", deleteCollection);

router.get("/homepage/festivals", listFestivals);
router.post("/homepage/festivals", createFestival);
router.patch("/homepage/festivals/:id", updateFestival);
router.delete("/homepage/festivals/:id", deleteFestival);

router.get("/homepage/blog-posts", listBlogPosts);
router.post("/homepage/blog-posts", createBlogPost);
router.patch("/homepage/blog-posts/:id", updateBlogPost);
router.delete("/homepage/blog-posts/:id", deleteBlogPost);

router.get("/homepage/featured-bundles", listFeaturedBundles);
router.post("/homepage/featured-bundles", createFeaturedBundle);
router.patch("/homepage/featured-bundles/:id", updateFeaturedBundle);
router.delete("/homepage/featured-bundles/:id", deleteFeaturedBundle);

// Flash Deals
router.get("/homepage/flash-deals", listFlashDeals);
router.patch("/homepage/flash-deals/:id", updateFlashDeal);

// Settings
router.get("/settings", getSettings);
router.patch("/settings/shiprocket", updateShiprocketSettings);
router.patch("/settings/shipping", updateShippingSettings);

export default router;
