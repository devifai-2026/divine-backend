import SubCategory from "../models/subcategory.model.js";
import Category from "../models/category.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// GET /api/subcategories/admin?categoryId=xxx  (Admin) — all including inactive
export const getAllSubCategoriesAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;

  const subCategories = await SubCategory.find(filter)
    .populate("categoryId", "id name icon")
    .sort({ name: 1 });

  return res.status(200).json(new ApiResponse(200, { subCategories }, "All sub-categories fetched successfully"));
});

// PATCH /api/subcategories/:id/toggle  (Admin) — flip isActive
export const toggleSubCategoryStatus = asyncHandler(async (req, res) => {
  const subCategory = await SubCategory.findById(req.params.id);
  if (!subCategory) {
    return res.status(404).json(new ApiResponse(404, null, "SubCategory not found"));
  }
  subCategory.isActive = !subCategory.isActive;
  await subCategory.save();
  const msg = subCategory.isActive ? "Sub-category activated successfully" : "Sub-category deactivated successfully";
  return res.status(200).json(new ApiResponse(200, { subCategory }, msg));
});

// GET /api/subcategories?categoryId=xxx
export const getSubCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;

  const subCategories = await SubCategory.find(filter)
    .populate("categoryId", "id name icon")
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

    let image = "";
    if (req.file?.path) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (uploaded?.secure_url) image = uploaded.secure_url;
    }

    const subCategory = await SubCategory.create({ id, name, image, categoryId });
    await subCategory.populate("categoryId", "id name icon");

    return res.status(201).json(new ApiResponse(201, { subCategory }, "SubCategory created successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PATCH /api/subcategories/:id  (Admin)
export const updateSubCategory = asyncHandler(async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.file?.path) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (uploaded?.secure_url) updates.image = uploaded.secure_url;
    }

    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate("categoryId", "id name icon");

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
