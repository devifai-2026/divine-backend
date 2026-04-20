import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import crypto from "crypto";

const generateTokens = (userId) => ({
  accessToken: generateAccessToken(userId),
  refreshToken: generateRefreshToken(userId),
});

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json(new ApiResponse(400, null, "Name, email and password are required"));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json(new ApiResponse(409, null, "Email already registered"));
    }

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return res.status(201).json(
      new ApiResponse(201, { user, accessToken, refreshToken }, "Registration successful")
    );
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json(new ApiResponse(400, null, "Email and password are required"));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json(new ApiResponse(401, null, "Invalid email or password"));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json(new ApiResponse(401, null, "Invalid email or password"));
  }

  const { accessToken, refreshToken } = generateTokens(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const safeUser = user.toJSON();

  return res.status(200).json(
    new ApiResponse(200, { user: safeUser, accessToken, refreshToken }, "Login successful")
  );
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: "" });
  return res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});

// POST /api/auth/refresh
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json(new ApiResponse(400, null, "Refresh token is required"));
  }

  const user = await User.findOne({ refreshToken });
  if (!user) {
    return res.status(401).json(new ApiResponse(401, null, "Invalid refresh token"));
  }

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(200, { accessToken: newAccessToken, refreshToken: newRefreshToken }, "Token refreshed")
  );
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json(new ApiResponse(400, null, "Email is required"));
  }

  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.status(200).json(
      new ApiResponse(200, null, "If this email exists, a reset link has been sent")
    );
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = hashedToken;
  user.passwordResetExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await user.save({ validateBeforeSave: false });

  // TODO: Send email with reset link containing `resetToken`
  // The reset link format: /reset-password?token=<resetToken>
  console.log(`Password reset token for ${email}: ${resetToken}`);

  return res.status(200).json(
    new ApiResponse(200, null, "If this email exists, a reset link has been sent")
  );
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json(new ApiResponse(400, null, "Token and new password are required"));
  }

  if (newPassword.length < 6) {
    return res.status(400).json(new ApiResponse(400, null, "Password must be at least 6 characters"));
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid or expired reset token"));
  }

  user.password = newPassword;
  user.passwordResetToken = "";
  user.passwordResetExpiry = undefined;
  user.refreshToken = "";
  await user.save();

  return res.status(200).json(new ApiResponse(200, null, "Password reset successful"));
});
