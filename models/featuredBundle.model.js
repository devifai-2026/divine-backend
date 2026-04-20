import mongoose from "mongoose";

const featuredBundleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  image: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number },
  discount: { type: String, default: "" },
  items: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const FeaturedBundle = mongoose.model("FeaturedBundle", featuredBundleSchema);
export default FeaturedBundle;
