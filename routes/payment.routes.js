import { Router } from "express";
import {
  getRazorpayKey,
  createRazorpayOrder,
  verifyPayment,
} from "../controllers/payment.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/key", getRazorpayKey);

// Authenticated payment routes
router.post("/create-order", verifyJWT, createRazorpayOrder);
router.post("/verify", verifyJWT, verifyPayment);

export default router;
