import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// â”€â”€â”€ STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/stats
export const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalProducts,
    totalOrders,
    totalUsers,
    revenueResult,
    thisMonthRevenue,
    lastMonthRevenue,
    thisMonthOrders,
    lastMonthOrders,
    thisMonthUsers,
    lastMonthUsers,
    recentOrders,
    lowStockProducts,
    orderStatusDist,
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    User.countDocuments(),
    Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments({ createdAt: { $gte: thisMonthStart } }),
    Order.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    User.countDocuments({ createdAt: { $gte: thisMonthStart } }),
    User.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    Order.find()
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(8),
    Product.find({ isActive: true, stockStatus: { $in: ["Low Stock", "Out of Stock"] } })
      .select("name image stockStatus stock category")
      .limit(10),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const calcGrowth = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const thisRev = thisMonthRevenue[0]?.total || 0;
  const lastRev = lastMonthRevenue[0]?.total || 0;

  return res.status(200).json(
    new ApiResponse(200, {
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenue: revenueResult[0]?.total || 0,
      revenueGrowth: calcGrowth(thisRev, lastRev),
      ordersGrowth: calcGrowth(thisMonthOrders, lastMonthOrders),
      usersGrowth: calcGrowth(thisMonthUsers, lastMonthUsers),
      recentOrders,
      lowStockProducts,
      orderStatusDist,
    }, "Stats fetched")
  );
});

// â”€â”€â”€ ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/analytics?period=7d|30d|90d
export const getAnalytics = asyncHandler(async (req, res) => {
  const { period = "30d" } = req.query;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const [dailyStats, orderStatusDist, topProducts, categoryRevenue] = await Promise.all([
    // Daily revenue + orders count
    Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Order status distribution
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // Top 10 products by revenue
    Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          totalQty: { $sum: "$items.quantity" },
          image: { $first: "$items.image" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]),

    // Revenue by category (via product lookup)
    Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$productInfo.category", "Other"] },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  // Fill in missing dates so chart has continuous data
  const dateMap = {};
  for (const d of dailyStats) dateMap[d._id] = d;
  const filledDays = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    filledDays.push(dateMap[key] || { _id: key, revenue: 0, orders: 0 });
  }

  return res.status(200).json(
    new ApiResponse(200, {
      dailyStats: filledDays,
      orderStatusDist,
      topProducts,
      categoryRevenue,
    }, "Analytics fetched")
  );
});

// â”€â”€â”€ PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildProductFilter({ search, searchBy = "all", category, status }) {
  const filter = {};

  if (search && search.trim()) {
    const s = search.trim();
    if (searchBy === "name") {
      filter.name = { $regex: s, $options: "i" };
    } else if (searchBy === "hsn") {
      filter.hsnCode = { $regex: s, $options: "i" };
    } else if (searchBy === "price") {
      const num = Number(s);
      if (!isNaN(num)) filter.price = num;
    } else if (searchBy === "gst") {
      const num = Number(s);
      if (!isNaN(num)) filter.gstRate = num;
    } else {
      const orClauses = [
        { name: { $regex: s, $options: "i" } },
        { hsnCode: { $regex: s, $options: "i" } },
        { category: { $regex: s, $options: "i" } },
      ];
      const num = Number(s);
      if (!isNaN(num)) {
        orClauses.push({ price: num }, { gstRate: num });
      }
      filter.$or = orClauses;
    }
  }

  if (category) filter.category = { $regex: category, $options: "i" };
  if (status === "active") filter.isActive = true;
  else if (status === "inactive") filter.isActive = false;
  if (status === "low_stock") {
    filter.isActive = true;
    filter.stockStatus = { $in: ["Low Stock", "Out of Stock"] };
  }

  return filter;
}

// GET /api/admin/products
export const getAllProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, searchBy, category, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = buildProductFilter({ search, searchBy, category, status });

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "Products fetched")
  );
});

// GET /api/admin/products/export
export const exportProducts = asyncHandler(async (req, res) => {
  const { search, searchBy, category, status } = req.query;
  const filter = buildProductFilter({ search, searchBy, category, status });

  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .select("name category subCategory price originalPrice gstRate hsnCode stock stockStatus isActive isEnergized isTrending isBestseller isFreshArrival material size collection createdAt");

  return res.status(200).json(
    new ApiResponse(200, { products }, "Export data fetched")
  );
});

// POST /api/admin/products/bulk  â€” bulk operations
export const bulkProductOps = asyncHandler(async (req, res) => {
  const { action, ids } = req.body;
  if (!ids?.length) {
    return res.status(400).json(new ApiResponse(400, null, "No product IDs provided"));
  }

  if (action === "delete") {
    const result = await Product.deleteMany({ _id: { $in: ids } });
    return res.status(200).json(
      new ApiResponse(200, { deletedCount: result.deletedCount }, `Products deleted successfully`)
    );
  }

  let update;
  if (action === "activate") update = { isActive: true };
  else if (action === "deactivate") update = { isActive: false };
  else {
    return res.status(400).json(new ApiResponse(400, null, "Invalid action"));
  }

  const result = await Product.updateMany({ _id: { $in: ids } }, update);
  return res.status(200).json(
    new ApiResponse(200, { modifiedCount: result.modifiedCount }, `Products ${action}d successfully`)
  );
});

// â”€â”€â”€ ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
  } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Search by orderId or customer name/email â€” needs populate after filter
  let query = Order.find(filter).populate("user", "name email avatar");
  if (search) {
    // Filter by orderId pattern first, then in memory for user fields
    const orderIdFilter = { ...filter, orderId: { $regex: search, $options: "i" } };
    const [byOrderId, total] = await Promise.all([
      Order.find(orderIdFilter)
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(orderIdFilter),
    ]);
    return res.status(200).json(
      new ApiResponse(200, {
        orders: byOrderId,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      }, "Orders fetched")
    );
  }

  const [orders, total] = await Promise.all([
    query.sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "Orders fetched")
  );
});

// PATCH /api/admin/orders/bulk-status
export const bulkOrderStatus = asyncHandler(async (req, res) => {
  const { status, ids } = req.body;
  if (!ids?.length) {
    return res.status(400).json(new ApiResponse(400, null, "No order IDs provided"));
  }
  const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid status"));
  }

  const result = await Order.updateMany(
    { _id: { $in: ids } },
    {
      $set: { status },
      $push: {
        timeline: {
          status,
          timestamp: new Date(),
          description: `Status updated to ${status} (bulk update)`,
        },
      },
    }
  );

  return res.status(200).json(
    new ApiResponse(200, { modifiedCount: result.modifiedCount }, "Orders updated")
  );
});

// â”€â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/users
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (role === "admin") filter.isAdmin = true;
  if (role === "member") filter.isDivineMember = true;
  if (role === "customer") { filter.isAdmin = false; filter.isDivineMember = false; }

  const [users, total] = await Promise.all([
    User.find(filter).select("-password -refreshToken -passwordResetToken -passwordResetExpiry -cart -addresses")
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "Users fetched")
  );
});

// GET /api/admin/users/:id
export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "-password -refreshToken -passwordResetToken -passwordResetExpiry"
  );

  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  const [orders, orderStats] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
    Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
    ]),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      user,
      orders,
      totalSpent: orderStats[0]?.totalSpent || 0,
      totalOrders: orderStats[0]?.totalOrders || 0,
    }, "User detail fetched")
  );
});

// PATCH /api/admin/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const { isAdmin, isDivineMember, karmaPoints } = req.body;

  // Prevent admin from removing their own admin status
  if (req.params.id === req.user._id.toString() && isAdmin === false) {
    return res.status(400).json(new ApiResponse(400, null, "Cannot remove your own admin status"));
  }

  const updateFields = {};
  if (typeof isAdmin === "boolean") updateFields.isAdmin = isAdmin;
  if (typeof isDivineMember === "boolean") updateFields.isDivineMember = isDivineMember;
  if (typeof karmaPoints === "number") updateFields.karmaPoints = karmaPoints;

  const user = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true })
    .select("-password -refreshToken -passwordResetToken -passwordResetExpiry");

  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  return res.status(200).json(new ApiResponse(200, { user }, "User updated"));
});

// DELETE /api/admin/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json(new ApiResponse(400, null, "Cannot delete your own account"));
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  return res.status(200).json(new ApiResponse(200, null, "User deleted"));
});

// â”€â”€â”€ REVIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/reviews
export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, minRating, maxRating } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find({ "reviews.0": { $exists: true } })
    .select("name image reviews")
    .lean();

  let allReviews = [];
  for (const product of products) {
    for (const review of product.reviews) {
      if (minRating && review.rating < Number(minRating)) continue;
      if (maxRating && review.rating > Number(maxRating)) continue;
      allReviews.push({
        ...review,
        productId: product._id,
        productName: product.name,
        productImage: product.image,
      });
    }
  }

  allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = allReviews.length;
  const paginated = allReviews.slice(skip, skip + Number(limit));

  return res.status(200).json(
    new ApiResponse(200, {
      reviews: paginated,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    }, "Reviews fetched")
  );
});

// DELETE /api/admin/reviews/:productId/:reviewId
export const deleteReview = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  const before = product.reviews.length;
  product.reviews = product.reviews.filter((r) => r._id.toString() !== reviewId);

  if (product.reviews.length === before) {
    return res.status(404).json(new ApiResponse(404, null, "Review not found"));
  }

  product.reviewCount = product.reviews.length;
  product.rating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

  await product.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, null, "Review deleted"));
});


// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
export const uploadAdminImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json(new ApiResponse(400, null, "No image file provided"));
  const result = await uploadOnCloudinary(req.file.path);
  if (!result) return res.status(500).json(new ApiResponse(500, null, "Cloudinary upload failed"));
  return res.status(200).json(new ApiResponse(200, { url: result.secure_url }, "Image uploaded"));
});
