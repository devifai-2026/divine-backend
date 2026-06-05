import { Router } from "express";
import {
  getSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  getAllSubCategoriesAdmin,
  toggleSubCategoryStatus,
} from "../controllers/subcategory.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/", getSubCategories);

// Admin routes
router.get("/admin", verifyJWT, isAdmin, getAllSubCategoriesAdmin);
router.post("/", verifyJWT, isAdmin, upload.single("image"), createSubCategory);
router.patch("/:id/toggle", verifyJWT, isAdmin, toggleSubCategoryStatus);
router.patch("/:id", verifyJWT, isAdmin, upload.single("image"), updateSubCategory);
router.delete("/:id", verifyJWT, isAdmin, deleteSubCategory);

export default router;
