import { Router } from "express";
import {
  getCategories,
  getNavCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesAdmin,
  toggleCategoryStatus,
} from "../controllers/category.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

router.get("/", getCategories);
router.get("/navbar", getNavCategories);

// Admin routes
router.get("/admin", verifyJWT, isAdmin, getAllCategoriesAdmin);
router.post("/", verifyJWT, isAdmin, createCategory);
router.patch("/:id/toggle", verifyJWT, isAdmin, toggleCategoryStatus);
router.patch("/:id", verifyJWT, isAdmin, updateCategory);
router.delete("/:id", verifyJWT, isAdmin, deleteCategory);

export default router;
