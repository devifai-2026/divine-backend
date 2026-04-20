import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Aggressively load and trim env variables
    const cloud_name = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    const api_key = (process.env.CLOUDINARY_API_KEY || "").trim();
    const api_secret = (process.env.CLOUDINARY_API_SECRET || "").trim();

    console.log("⚙️ Cloudinary Config Debug:", {
      cloud_name,
      api_key_preview: api_key ? `${api_key.substring(0, 4)}...` : "MISSING",
      secret_length: api_secret.length
    });

    if (!cloud_name || !api_key || !api_secret) {
      console.error("❌ CLOUDINARY ERROR: One or more credentials are empty after trimming!");
      return null;
    }

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret
    });

    console.log("📤 Uploading to Cloudinary from path:", localFilePath);

    // Upload the file on cloudinary with EXPLICIT credentials passed in
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      cloud_name,
      api_key,
      api_secret
    });
    
    console.log("✅ Cloudinary Response Received");
    // file has been uploaded successfull
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    console.error("CLOUDINARY UPLOAD ERROR:", error);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation failed
    }
    return null;
  }
};

export { uploadOnCloudinary };
