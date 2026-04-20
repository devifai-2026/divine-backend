import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const getCartTotal = (cart) =>
  cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("cart")
    .populate("cart.product", "name image price stockStatus isActive");

  const cart = user.cart.filter((item) => item.product && item.product.isActive);
  const total = getCartTotal(cart);

  return res.status(200).json(
    new ApiResponse(200, { cart, total }, "Cart fetched successfully")
  );
});

// POST /api/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json(new ApiResponse(400, null, "Product ID is required"));
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  if (product.stockStatus === "Out of Stock") {
    return res.status(400).json(new ApiResponse(400, null, "Product is out of stock"));
  }

  const user = await User.findById(req.user._id);
  const existingItem = user.cart.find(
    (item) => item.product.toString() === productId
  );

  if (existingItem) {
    existingItem.quantity += Number(quantity);
  } else {
    user.cart.push({ product: productId, quantity: Number(quantity), price: product.price });
  }

  await user.save({ validateBeforeSave: false });
  await user.populate("cart.product", "name image price stockStatus isActive");

  const total = getCartTotal(user.cart);
  return res.status(200).json(
    new ApiResponse(200, { cart: user.cart, total }, "Item added to cart")
  );
});

// PUT /api/cart/:itemId
export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json(new ApiResponse(400, null, "Quantity must be at least 1"));
  }

  const user = await User.findById(req.user._id);
  const item = user.cart.id(req.params.itemId);

  if (!item) {
    return res.status(404).json(new ApiResponse(404, null, "Cart item not found"));
  }

  item.quantity = Number(quantity);
  await user.save({ validateBeforeSave: false });
  await user.populate("cart.product", "name image price stockStatus isActive");

  const total = getCartTotal(user.cart);
  return res.status(200).json(
    new ApiResponse(200, { cart: user.cart, total }, "Cart updated successfully")
  );
});

// DELETE /api/cart/:itemId
export const removeFromCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const item = user.cart.id(req.params.itemId);

  if (!item) {
    return res.status(404).json(new ApiResponse(404, null, "Cart item not found"));
  }

  item.deleteOne();
  await user.save({ validateBeforeSave: false });
  await user.populate("cart.product", "name image price stockStatus isActive");

  const total = getCartTotal(user.cart);
  return res.status(200).json(
    new ApiResponse(200, { cart: user.cart, total }, "Item removed from cart")
  );
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { cart: [] });
  return res.status(200).json(new ApiResponse(200, { cart: [], total: 0 }, "Cart cleared"));
});
