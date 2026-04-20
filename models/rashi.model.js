import mongoose from "mongoose";

const rashiSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sanskrit: { type: String, required: true, trim: true },
  icon: { type: String, default: "♈" },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Rashi = mongoose.model("Rashi", rashiSchema);
export default Rashi;
