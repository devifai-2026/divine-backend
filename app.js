import express from "express";
import cors from "cors";
import http from "http";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import userRoutes from "./routes/user.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import subCategoryRoutes from "./routes/subcategory.routes.js";
import homepageRoutes from "./routes/homepage.routes.js";

const app = express();
const server = http.createServer(app);

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, origin);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api/homepage", homepageRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Home
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to Divine Shop API",
    version: "1.0.0",
    status: "active",
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
  });
});

export { server };
export default app;
