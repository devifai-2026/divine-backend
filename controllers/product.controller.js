import Product from "../models/product.model.js";
import Redirect from "../models/redirect.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { slugify, uniqueSlug } from "../utils/slugify.js";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// Parse arrays sent as "key" or "key[]" from multipart FormData
const extractArray = (body, key) => {
  const val = body[key] ?? body[`${key}[]`];
  if (val == null) return undefined;
  return [].concat(val).filter(Boolean);
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
      isBraceletCollection,
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
    if (isBraceletCollection === "true") filter.isBraceletCollection = true;
    if (isFlashDeal === "true") filter.isFlashDeal = true;

    // Array fields — support repeated query params or comma-separated
    const purposeVal = purpose || req.query.purposes;
    if (purposeVal) {
      const vals = [].concat(purposeVal).flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
      if (vals.length) {
        // Match if ANY of the values match (case-insensitive)
        filter.purpose = { $in: vals.map(v => new RegExp(`^${v}$`, "i")) };
      }
    }
    const rashiVal = rashi || req.query.rashis;
    if (rashiVal) {
      const vals = [].concat(rashiVal).flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
      if (vals.length) {
        filter.rashi = { $in: vals.map(v => new RegExp(`^${v}$`, "i")) };
      }
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
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  return res.status(200).json(new ApiResponse(200, { product }, "Product fetched successfully"));
});

// GET /api/products/slug/:slug
export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Support legacy /:id URLs — if param looks like a MongoDB ObjectId, fall through to ID lookup
  if (OBJECT_ID_RE.test(slug)) {
    const product = await Product.findById(slug);
    if (!product) return res.status(404).json(new ApiResponse(404, null, "Product not found"));
    return res.status(200).json(new ApiResponse(200, { product }, "Product fetched successfully"));
  }

  let product = await Product.findOne({ slug, isActive: true });

  if (!product) {
    // Check 301 redirect table
    const redirect = await Redirect.findOne({ from: `/product/${slug}` });
    if (redirect) {
      return res.status(redirect.statusCode).json(
        new ApiResponse(redirect.statusCode, { redirectTo: redirect.to }, "Redirect")
      );
    }
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

    if (req.files && req.files.length > 0) {
      const uploadedUrls = [];
      for (const file of req.files) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded) uploadedUrls.push(uploaded.secure_url);
      }
      if (uploadedUrls.length > 0) {
        data.images = uploadedUrls;
        data.image = uploadedUrls[0];
      }
    }

    if (data.features && typeof data.features === "string") {
      data.features = data.features.split(",").map((f) => f.trim()).filter(Boolean);
    }

    if (data.specifications && typeof data.specifications === "string") {
      try {
        const parsed = JSON.parse(data.specifications);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          return res.status(400).json(new ApiResponse(400, null, "Specifications must be a JSON object e.g. {\"Weight\": \"450g\"}"));
        }
        data.specifications = parsed;
      } catch (e) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid JSON format for specifications"));
      }
    }

    // FormData sends arrays as "purpose[]" / "rashi[]" keys
    const purposeArr = extractArray(req.body, "purpose");
    if (purposeArr !== undefined) { data.purpose = purposeArr; delete data["purpose[]"]; }
    const rashiArr = extractArray(req.body, "rashi");
    if (rashiArr !== undefined) { data.rashi = rashiArr; delete data["rashi[]"]; }

    if (data.crystals && typeof data.crystals === "string") {
      try { data.crystals = JSON.parse(data.crystals); } catch { data.crystals = []; }
    }

    // Auto-generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = await uniqueSlug(slugify(data.name), Product);
    } else if (data.slug) {
      data.slug = await uniqueSlug(slugify(data.slug), Product);
    }

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

    // For existing images kept by the user, frontend sends "existingImages[]"
    const existingImages = extractArray(req.body, "existingImages") || [];
    data.images = [...existingImages];

    if (req.files && req.files.length > 0) {
      const uploadedUrls = [];
      for (const file of req.files) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded) uploadedUrls.push(uploaded.secure_url);
      }
      if (uploadedUrls.length > 0) {
        data.images = [...data.images, ...uploadedUrls];
      }
    }
    
    if (data.images && data.images.length > 0) {
      data.image = data.images[0];
    } else {
      data.image = "";
      data.images = [];
    }

    if (data.features && typeof data.features === "string") {
      data.features = data.features.split(",").map((f) => f.trim()).filter(Boolean);
    }

    if (data.specifications && typeof data.specifications === "string") {
      try {
        const parsed = JSON.parse(data.specifications);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          return res.status(400).json(new ApiResponse(400, null, "Specifications must be a JSON object e.g. {\"Weight\": \"450g\"}"));
        }
        data.specifications = parsed;
      } catch (e) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid JSON format for specifications"));
      }
    }

    // FormData sends arrays as "purpose[]" / "rashi[]" keys
    const purposeArr = extractArray(req.body, "purpose");
    if (purposeArr !== undefined) { data.purpose = purposeArr; delete data["purpose[]"]; }
    const rashiArr = extractArray(req.body, "rashi");
    if (rashiArr !== undefined) { data.rashi = rashiArr; delete data["rashi[]"]; }

    if (data.crystals && typeof data.crystals === "string") {
      try { data.crystals = JSON.parse(data.crystals); } catch { data.crystals = []; }
    }

    // Slug handling on update
    const existing = await Product.findById(req.params.id).select("slug name").lean();
    if (!existing) {
      return res.status(404).json(new ApiResponse(404, null, "Product not found"));
    }

    const oldSlug = existing.slug;

    if (data.slug) {
      data.slug = await uniqueSlug(slugify(data.slug), Product, req.params.id);
    } else if (data.name && data.name !== existing.name && !data.slug) {
      // Name changed but no explicit slug provided — regenerate
      data.slug = await uniqueSlug(slugify(data.name), Product, req.params.id);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json(new ApiResponse(404, null, "Product not found"));
    }

    // If slug changed, create a 301 redirect from old slug to new slug
    if (oldSlug && product.slug && oldSlug !== product.slug) {
      await Redirect.findOneAndUpdate(
        { from: `/product/${oldSlug}` },
        { from: `/product/${oldSlug}`, to: `/product/${product.slug}`, statusCode: 301, reason: "Slug changed" },
        { upsert: true }
      );
    }

    return res.status(200).json(new ApiResponse(200, { product }, "Product updated successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// DELETE /api/products/:id  (Admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

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
