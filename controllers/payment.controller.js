import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createShiprocketShipment } from "./shipping.controller.js";

const getRazorpayInstance = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

// GET /api/payment/key
export const getRazorpayKey = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { key: process.env.RAZORPAY_KEY_ID }, "Razorpay key")
  );
});

// POST /api/payment/create-order
// Called before showing the Razorpay payment modal
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json(new ApiResponse(400, null, "Order ID is required"));
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  if (order.paymentStatus === "completed") {
    return res.status(400).json(new ApiResponse(400, null, "Order is already paid"));
  }

  const razorpay = getRazorpayInstance();
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.total * 100), // amount in paise
    currency: "INR",
    receipt: order.orderId,
  });

  order.razorpayOrderId = razorpayOrder.id;
  await order.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(200, {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order._id,
    }, "Razorpay order created")
  );
});

// POST /api/payment/verify
// Called after Razorpay payment success callback
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId) {
    return res.status(400).json(new ApiResponse(400, null, "All payment fields are required"));
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json(new ApiResponse(400, null, "Payment verification failed - Invalid signature"));
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.paymentStatus = "completed";
  await order.save({ validateBeforeSave: false });

  // Clear cart only after payment is confirmed
  await User.findByIdAndUpdate(order.user, { cart: [] });

  // Fire-and-forget: create Shiprocket shipment — don't block the payment response
  createShiprocketShipment(order._id).catch((err) => {
    console.error(`[Shiprocket] Failed to create shipment for order ${order.orderId}:`, err?.response?.data || err.message);
  });

  return res.status(200).json(
    new ApiResponse(200, { order }, "Payment verified successfully")
  );
});
