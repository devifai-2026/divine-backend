import BlogPost from "../models/blogPost.model.js";
import "../models/product.model.js"; // register Product model before populate
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/blogs?page=1&limit=9&category=...
export const getBlogs = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 9);
  const skip  = (page - 1) * limit;

  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;

  const [posts, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-content")   // exclude heavy content from list view
      .lean(),
    BlogPost.countDocuments(filter),
  ]);

  return res.json(new ApiResponse(200, {
    posts,
    total,
    page,
    pages: Math.ceil(total / limit),
  }, "Blog posts fetched"));
});

// GET /api/blogs/:slug
export const getBlogBySlug = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, isActive: true })
    .populate("taggedProduct", "_id name image price slug originalPrice rating reviewCount benefit")
    .lean();
  if (!post) {
    return res.status(404).json(new ApiResponse(404, null, "Blog post not found"));
  }
  return res.json(new ApiResponse(200, { post }, "Blog post fetched"));
});
