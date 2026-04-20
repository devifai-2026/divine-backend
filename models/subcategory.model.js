import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

subCategorySchema.index({ categoryId: 1 });

const SubCategory = mongoose.model("SubCategory", subCategorySchema);
export default SubCategory;
