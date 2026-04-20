import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
} from "../controllers/order.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

router.use(verifyJWT);

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/admin/all", isAdmin, getAllOrders);
router.get("/:orderId", getOrderById);
router.patch("/:orderId/status", isAdmin, updateOrderStatus);
router.patch("/:orderId/cancel", cancelOrder);

export default router;
