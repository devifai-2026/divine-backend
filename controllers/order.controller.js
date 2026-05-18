import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { shiprocket } from "../utils/shiprocket.js";

const SHIPPING_THRESHOLD = 2000;
const SHIPPING_COST = 150;

// POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || !items.length) {
      return res.status(400).json(new ApiResponse(400, null, "Order items are required"));
    }

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json(new ApiResponse(400, null, "Shipping address and payment method are required"));
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId || item.product, isActive: true });
      if (!product) {
        return res.status(404).json(new ApiResponse(404, null, `Product not found: ${item.productId || item.product}`));
      }

      const orderItem = {
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: Number(item.quantity),
        image: product.image,
      };

      orderItems.push(orderItem);
      subtotal += product.price * Number(item.quantity);
    }

    const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = subtotal + shipping;

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal,
      shipping,
      total,
      shippingAddress,
      paymentMethod,
      paymentStatus: "pending",
    });

    // Cart is cleared only after payment is verified, not here
    return res.status(201).json(
      new ApiResponse(201, { order }, "Order placed successfully")
    );
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// GET /api/orders
export const getOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments({ user: req.user._id }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "Orders fetched successfully")
  );
});

// GET /api/orders/:orderId  — includes live Shiprocket tracking when AWB is available
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user: req.user._id,
  });

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  let liveTracking = null;
  if (order.awbCode) {
    try {
      liveTracking = await shiprocket("GET", `/courier/track/awb/${order.awbCode}`);
    } catch {
      // Shiprocket unavailable — local timeline still returned
    }
  }

  return res.status(200).json(
    new ApiResponse(200, { order, liveTracking }, "Order fetched successfully")
  );
});

// GET /api/orders/track/:friendlyOrderId  — track by human-readable ORD-xxx string
export const trackOrderByFriendlyId = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    orderId: req.params.friendlyOrderId,
    user: req.user._id,
  });

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  let liveTracking = null;
  if (order.awbCode) {
    try {
      liveTracking = await shiprocket("GET", `/courier/track/awb/${order.awbCode}`);
    } catch {
      // local data still returned
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        awbCode: order.awbCode,
        courierName: order.courierName,
        edd: order.edd,
        timeline: order.timeline,
        shippingAddress: order.shippingAddress,
        items: order.items,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        liveTracking,
      },
      "Order tracking fetched"
    )
  );
});

// PATCH /api/orders/:orderId/status  (Admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, description } = req.body;

  const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid status value"));
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  order.status = status;
  order.timeline.push({
    status,
    description: description || `Order ${status.toLowerCase()}`,
    timestamp: new Date(),
  });

  if (status === "Delivered") {
    order.paymentStatus = "completed";
    const karmaPoints = Math.floor(order.total / 100);
    await User.findByIdAndUpdate(order.user, {
      $inc: { karmaPoints },
    });
  }

  await order.save();
  return res.status(200).json(new ApiResponse(200, { order }, "Order status updated"));
});

// PATCH /api/orders/:orderId/cancel
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  if (["Delivered", "Cancelled"].includes(order.status)) {
    return res.status(400).json(new ApiResponse(400, null, `Cannot cancel an order that is ${order.status}`));
  }

  order.status = "Cancelled";
  order.timeline.push({ status: "Cancelled", description: "Order cancelled by customer" });
  await order.save();

  return res.status(200).json(new ApiResponse(200, { order }, "Order cancelled successfully"));
});

// GET /api/orders/admin/all  (Admin)
export const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, paymentStatus, search, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) filter.orderId = { $regex: search, $options: "i" };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "All orders fetched")
  );
});

// PATCH /api/orders/admin/bulk-status  (Admin)
export const bulkUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;

  const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid status value"));
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, "Order IDs array is required"));
  }

  const timelineEntry = { status, description: `Order ${status.toLowerCase()} (bulk update)`, timestamp: new Date() };

  await Order.updateMany(
    { _id: { $in: ids } },
    { $set: { status }, $push: { timeline: timelineEntry } }
  );

  if (status === "Delivered") {
    const orders = await Order.find({ _id: { $in: ids } }, "user total paymentStatus");
    await Promise.all(
      orders.map((o) => {
        const updates = {};
        if (o.paymentStatus !== "completed") updates.paymentStatus = "completed";
        const karma = Math.floor(o.total / 100);
        if (karma > 0) return User.findByIdAndUpdate(o.user, { $inc: { karmaPoints: karma }, ...updates });
        if (Object.keys(updates).length) return Order.findByIdAndUpdate(o._id, updates);
        return Promise.resolve();
      })
    );
  }

  return res.status(200).json(new ApiResponse(200, { updated: ids.length }, `${ids.length} orders updated to ${status}`));
});
