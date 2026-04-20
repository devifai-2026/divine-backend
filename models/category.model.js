import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
}, { _id: false });

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  image: { type: String, default: "" },
  icon: { type: String, default: "" },
  subCategories: [subCategorySchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;
