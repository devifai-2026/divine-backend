import Category from "../models/category.model.js";
import SubCategory from "../models/subcategory.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";

// GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  return res.status(200).json(new ApiResponse(200, { categories }, "Categories fetched successfully"));
});

// GET /api/categories/navbar — categories + subcategories in one call (used by frontend navbar)
export const getNavCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  const subCategories = await SubCategory.find({ isActive: true }).select("_id id name image categoryId").lean();

  // group subcategories by categoryId
  const subMap = {};
  for (const sub of subCategories) {
    const key = sub.categoryId.toString();
    if (!subMap[key]) subMap[key] = [];
    subMap[key].push({ _id: sub._id, id: sub.id, name: sub.name, image: sub.image || "" });
  }

  const result = categories.map((cat) => {
    // Prefer the separate SubCategory collection; fall back to the embedded array
    // (embedded schema has _id:false, so synthesise _id from id for the frontend)
    const fromCollection = subMap[cat._id.toString()];
    const fromEmbedded = (cat.subCategories || []).map((s) => ({
      _id: s.id,
      id: s.id,
      name: s.name,
    }));
    return {
      ...cat,
      subCategories: fromCollection ?? fromEmbedded,
    };
  });

  return res.status(200).json(new ApiResponse(200, { categories: result }, "Nav categories fetched successfully"));
});

// POST /api/categories  (Admin)
export const createCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.create(req.body);
    return res.status(201).json(new ApiResponse(201, { category }, "Category created successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PATCH /api/categories/:id  (Admin)
export const updateCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json(new ApiResponse(404, null, "Category not found"));
    }

    return res.status(200).json(new ApiResponse(200, { category }, "Category updated successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// DELETE /api/categories/:id  (Admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

  if (!category) {
    return res.status(404).json(new ApiResponse(404, null, "Category not found"));
  }

  return res.status(200).json(new ApiResponse(200, null, "Category deleted successfully"));
});
