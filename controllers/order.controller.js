import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";

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

    // Validate & build order items from DB
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
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
    });

    // Clear user's cart after order
    await User.findByIdAndUpdate(req.user._id, { cart: [] });

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

// GET /api/orders/:orderId
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user: req.user._id,
  });

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  return res.status(200).json(new ApiResponse(200, { order }, "Order fetched successfully"));
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
    // Award karma points (1 point per ₹100)
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
  const { page = 1, limit = 20, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (status) filter.status = status;

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
