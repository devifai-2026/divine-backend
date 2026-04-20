import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import app, { server } from "./app.js";
import connectDB from "./db/index.js";



connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection failed", err));