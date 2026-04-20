import mongoose from "mongoose";

const festivalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  description: { type: String, default: "", trim: true },
  color: { type: String, default: "from-orange-500 to-red-600" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Festival = mongoose.model("Festival", festivalSchema);
export default Festival;
