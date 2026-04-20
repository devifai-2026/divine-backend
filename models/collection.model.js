import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Collection = mongoose.model("Collection", collectionSchema);
export default Collection;
