import mongoose from "mongoose";

const heroSlideSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: "", trim: true },
  tagline: { type: String, default: "", trim: true },
  image: { type: String, required: true },
  mobileImage: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const HeroSlide = mongoose.model("HeroSlide", heroSlideSchema);
export default HeroSlide;
