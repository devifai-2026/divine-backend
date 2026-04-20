import { Router } from "express";
import {
  getProducts,
  getProductById,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
} from "../controllers/product.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/:id/related", getRelatedProducts);
router.post("/:id/reviews", verifyJWT, addReview);

// Admin routes
router.post("/", verifyJWT, isAdmin, upload.single("image"), createProduct);
router.patch("/:id", verifyJWT, isAdmin, upload.single("image"), updateProduct);
router.delete("/:id", verifyJWT, isAdmin, deleteProduct);

export default router;
