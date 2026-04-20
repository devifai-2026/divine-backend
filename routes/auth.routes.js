import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", verifyJWT, logout);
router.post("/refresh", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
