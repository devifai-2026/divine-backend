import mongoose from "mongoose";

const redirectSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, unique: true, trim: true, lowercase: true },
    to:   { type: String, required: true, trim: true },
    statusCode: { type: Number, default: 301, enum: [301, 302] },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

redirectSchema.index({ from: 1 });

const Redirect = mongoose.model("Redirect", redirectSchema);
export default Redirect;
