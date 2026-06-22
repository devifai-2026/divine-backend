import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, lowercase: true },
  excerpt: { type: String, default: "", trim: true },
  content: { type: String, default: "" },
  date: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  category: { type: String, default: "Spiritual Wisdom", trim: true },
  author: { type: String, default: "Crystaura", trim: true },
  datePublished: { type: Date },
  dateModified: { type: Date },
  isActive: { type: Boolean, default: true },
  // SEO fields
  meta_title: { type: String, default: "", trim: true, maxlength: 60 },
  meta_description: { type: String, default: "", trim: true, maxlength: 160 },
  canonical_url: { type: String, default: "", trim: true },
  og_title: { type: String, default: "", trim: true },
  og_description: { type: String, default: "", trim: true },
  og_image: { type: String, default: "", trim: true },
}, { timestamps: true });

blogPostSchema.index({ slug: 1 }, { unique: true, sparse: true });

const BlogPost = mongoose.model("BlogPost", blogPostSchema);
export default BlogPost;
