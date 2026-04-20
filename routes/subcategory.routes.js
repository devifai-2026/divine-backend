import { Router } from "express";
import {
  getSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subcategory.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

router.get("/", getSubCategories);

// Admin routes
router.post("/", verifyJWT, isAdmin, createSubCategory);
router.patch("/:id", verifyJWT, isAdmin, updateSubCategory);
router.delete("/:id", verifyJWT, isAdmin, deleteSubCategory);

export default router;
