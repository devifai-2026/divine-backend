import SubCategory from "../models/subcategory.model.js";
import Category from "../models/category.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";

// GET /api/subcategories?categoryId=xxx
export const getSubCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;

  const subCategories = await SubCategory.find(filter)
    .populate("categoryId", "id name")
    .sort({ name: 1 });

  return res.status(200).json(new ApiResponse(200, { subCategories }, "SubCategories fetched successfully"));
});

// POST /api/subcategories  (Admin)
export const createSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id, name, categoryId } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json(new ApiResponse(404, null, "Parent category not found"));
    }

    const subCategory = await SubCategory.create({ id, name, categoryId });
    await subCategory.populate("categoryId", "id name");

    return res.status(201).json(new ApiResponse(201, { subCategory }, "SubCategory created successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PATCH /api/subcategories/:id  (Admin)
export const updateSubCategory = asyncHandler(async (req, res) => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("categoryId", "id name");

    if (!subCategory) {
      return res.status(404).json(new ApiResponse(404, null, "SubCategory not found"));
    }

    return res.status(200).json(new ApiResponse(200, { subCategory }, "SubCategory updated successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// DELETE /api/subcategories/:id  (Admin)
export const deleteSubCategory = asyncHandler(async (req, res) => {
  const subCategory = await SubCategory.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!subCategory) {
    return res.status(404).json(new ApiResponse(404, null, "SubCategory not found"));
  }

  return res.status(200).json(new ApiResponse(200, null, "SubCategory deleted successfully"));
});
