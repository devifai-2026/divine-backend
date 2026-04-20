import Product from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// Parse arrays sent as "key" or "key[]" from multipart FormData
const extractArray = (body, key) => {
  const val = body[key] ?? body[`${key}[]`];
  if (val == null) return undefined;
  return [].concat(val);
};

// GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  try {
    const {
      category,
      subCategory,
      search,
      minPrice,
      maxPrice,
      minRating,
      isEnergized,
      isTrending,
      isBestseller,
      isFreshArrival,
      isFlashDeal,
      purpose,
      rashi,
      collection,
      stockStatus,
      energyLevel,
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true };

    if (category) filter.category = { $regex: new RegExp(category, "i") };
    if (subCategory) filter.subCategory = { $regex: new RegExp(subCategory, "i") };

    // Boolean flags
    if (isEnergized === "true") filter.isEnergized = true;
    if (isEnergized === "false") filter.isEnergized = false;
    if (isTrending === "true") filter.isTrending = true;
    if (isBestseller === "true") filter.isBestseller = true;
    if (isFreshArrival === "true") filter.isFreshArrival = true;
    if (isFlashDeal === "true") filter.isFlashDeal = true;

    // Array fields — support repeated query params or comma-separated
    if (purpose) {
      const vals = [].concat(purpose).flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
      if (vals.length) filter.purpose = { $in: vals };
    }
    if (rashi) {
      const vals = [].concat(rashi).flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
      if (vals.length) filter.rashi = { $in: vals };
    }

    // Enum / string fields
    if (collection) filter.collection = { $regex: new RegExp(collection, "i") };
    if (stockStatus) filter.stockStatus = stockStatus;
    if (energyLevel) filter.energyLevel = energyLevel;

    // Price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Minimum rating
    if (minRating) filter.rating = { $gte: Number(minRating) };

    // Full-text search
    if (search) filter.$text = { $search: search };

    // Sort — whitelist field names to prevent injection
    const SORTABLE = ["createdAt", "price", "rating", "reviewCount", "name"];
    const sortField = SORTABLE.includes(sort) ? sort : "createdAt";
    const sortDir = order === "asc" ? 1 : -1;
    const sortObj = search
      ? { score: { $meta: "textScore" }, [sortField]: sortDir }
      : { [sortField]: sortDir };

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter, search ? { score: { $meta: "textScore" } } : {})
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        products,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      }, "Products fetched successfully")
    );
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// GET /api/products/:id
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true });

  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  return res.status(200).json(new ApiResponse(200, { product }, "Product fetched successfully"));
});

// GET /api/products/:id/related
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true,
  }).limit(6);

  return res.status(200).json(new ApiResponse(200, { products: related }, "Related products fetched"));
});

// POST /api/products  (Admin)
export const createProduct = asyncHandler(async (req, res) => {
  try {
    const data = { ...req.body };

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (uploaded) {
        data.image = uploaded.secure_url;
        data.images = [uploaded.secure_url];
      }
    }

    if (data.features && typeof data.features === "string") {
      data.features = data.features.split(",").map((f) => f.trim()).filter(Boolean);
    }

    if (data.specifications && typeof data.specifications === "string") {
      data.specifications = JSON.parse(data.specifications);
    }

    // FormData sends arrays as "purpose[]" / "rashi[]" keys
    const purposeArr = extractArray(req.body, "purpose");
    if (purposeArr !== undefined) { data.purpose = purposeArr; delete data["purpose[]"]; }
    const rashiArr = extractArray(req.body, "rashi");
    if (rashiArr !== undefined) { data.rashi = rashiArr; delete data["rashi[]"]; }

    const product = await Product.create(data);
    return res.status(201).json(new ApiResponse(201, { product }, "Product created successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PATCH /api/products/:id  (Admin)
export const updateProduct = asyncHandler(async (req, res) => {
  try {
    const data = { ...req.body };

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (uploaded) {
        data.image = uploaded.secure_url;
      }
    }

    if (data.features && typeof data.features === "string") {
      data.features = data.features.split(",").map((f) => f.trim()).filter(Boolean);
    }

    if (data.specifications && typeof data.specifications === "string") {
      data.specifications = JSON.parse(data.specifications);
    }

    // FormData sends arrays as "purpose[]" / "rashi[]" keys
    const purposeArr = extractArray(req.body, "purpose");
    if (purposeArr !== undefined) { data.purpose = purposeArr; delete data["purpose[]"]; }
    const rashiArr = extractArray(req.body, "rashi");
    if (rashiArr !== undefined) { data.rashi = rashiArr; delete data["rashi[]"]; }

    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json(new ApiResponse(404, null, "Product not found"));
    }

    return res.status(200).json(new ApiResponse(200, { product }, "Product updated successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// DELETE /api/products/:id  (Admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  return res.status(200).json(new ApiResponse(200, null, "Product deleted successfully"));
});

// POST /api/products/:id/reviews
export const addReview = asyncHandler(async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json(new ApiResponse(400, null, "Rating and comment are required"));
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json(new ApiResponse(404, null, "Product not found"));
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json(new ApiResponse(400, null, "You already reviewed this product"));
    }

    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
    product.reviewCount = product.reviews.length;
    product.rating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;

    await product.save();
    return res.status(201).json(new ApiResponse(201, { product }, "Review added successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});
