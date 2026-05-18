import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  trackOrderByFriendlyId,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  bulkUpdateOrderStatus,
} from "../controllers/order.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

router.use(verifyJWT);

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/admin/all", isAdmin, getAllOrders);
router.patch("/admin/bulk-status", isAdmin, bulkUpdateOrderStatus);

// Must be before /:orderId so "track" isn't consumed as a param
router.get("/track/:friendlyOrderId", trackOrderByFriendlyId);

router.get("/:orderId", getOrderById);
router.patch("/:orderId/status", isAdmin, updateOrderStatus);
router.patch("/:orderId/cancel", cancelOrder);

export default router;
