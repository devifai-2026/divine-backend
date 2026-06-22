import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
}, { timestamps: true });

const crystalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  benefit: { type: String, default: '', trim: true },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, lowercase: true },
  category: { type: String, required: true, trim: true },
  subCategory: { type: String, default: "", trim: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  hsnCode: { type: String, default: '', trim: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  reviews: [reviewSchema],
  images: [{ type: String }],
  image: { type: String, default: "" },
  benefit: { type: String, default: "" },
  energyLevel: {
    type: String,
    enum: ["High", "Medium", "Very High"],
    default: "Medium",
  },
  isEnergized: { type: Boolean, default: false },
  material: { type: String, default: "" },
  size: { type: String, default: "" },
  isTrending: { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  isFreshArrival: { type: Boolean, default: false },
  isFlashDeal: { type: Boolean, default: false },
  flashDealDiscount: { type: Number, default: 0, min: 0, max: 100 },
  flashDealEndsAt: { type: Date },
  purpose: [{ type: String }],
  rashi: [{ type: String }],
  collection: { type: String, default: "" },
  description: { type: String, required: true },
  howToUse: { type: String, default: '' },
  features: [{ type: String }],
  specifications: { type: Map, of: String, default: {} },
  stockStatus: {
    type: String,
    enum: ["In Stock", "Low Stock", "Out of Stock"],
    default: "In Stock",
  },
  stock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  crystals: [crystalSchema],
  // SEO fields
  meta_title: { type: String, default: "", trim: true, maxlength: 60 },
  meta_description: { type: String, default: "", trim: true, maxlength: 160 },
  canonical_url: { type: String, default: "", trim: true },
  og_title: { type: String, default: "", trim: true },
  og_description: { type: String, default: "", trim: true },
  og_image: { type: String, default: "", trim: true },
}, { timestamps: true });

productSchema.index({ slug: 1 }, { unique: true, sparse: true });
productSchema.index({ name: "text", description: "text", category: "text" });
productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isEnergized: 1 });
productSchema.index({ isTrending: 1 });
productSchema.index({ isBestseller: 1 });
productSchema.index({ isFreshArrival: 1 });
productSchema.index({ isFlashDeal: 1 });
productSchema.index({ stockStatus: 1 });
productSchema.index({ collection: 1 });
productSchema.index({ purpose: 1 });
productSchema.index({ rashi: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
