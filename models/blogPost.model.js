import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  excerpt: { type: String, default: "", trim: true },
  date: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  category: { type: String, default: "Spiritual Wisdom", trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const BlogPost = mongoose.model("BlogPost", blogPostSchema);
export default BlogPost;
