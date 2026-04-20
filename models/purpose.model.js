import mongoose from "mongoose";

const purposeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: "🌟" },
  color: { type: String, default: "from-amber-200/20 to-brand-primary/10" },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Purpose = mongoose.model("Purpose", purposeSchema);
export default Purpose;
