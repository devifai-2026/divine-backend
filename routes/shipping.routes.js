import { Router } from "express";
import {
  trackShipment,
  checkServiceability,
  getShipmentStatus,
  cancelShipment,
  handleShiprocketWebhook,
  testShiprocketAuth,
  mockShipment,
  mockWebhook,
} from "../controllers/shipping.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

// Public — Shiprocket calls this; protected by ?token= query param, not JWT
router.post("/webhook", handleShiprocketWebhook);

router.get("/serviceability", checkServiceability);
router.get("/track/:awb", verifyJWT, trackShipment);
router.get("/order/:orderId", verifyJWT, getShipmentStatus);
router.post("/cancel/:orderId", verifyJWT, isAdmin, cancelShipment);
router.get("/test-auth", verifyJWT, isAdmin, testShiprocketAuth);
router.post("/mock-shipment/:orderId", verifyJWT, isAdmin, mockShipment);
router.post("/mock-webhook", mockWebhook);

export default router;
