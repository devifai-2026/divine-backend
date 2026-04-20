import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import handleMongoErrors from "../utils/mongooseError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// GET /api/user/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken -passwordResetToken -passwordResetExpiry");
  return res.status(200).json(new ApiResponse(200, { user }, "Profile fetched successfully"));
});

// PUT /api/user/profile
export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (uploaded) updates.avatar = uploaded.secure_url;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password -refreshToken -passwordResetToken -passwordResetExpiry");

    return res.status(200).json(new ApiResponse(200, { user }, "Profile updated successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PUT /api/user/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json(new ApiResponse(400, null, "Current and new password are required"));
  }

  if (newPassword.length < 6) {
    return res.status(400).json(new ApiResponse(400, null, "Password must be at least 6 characters"));
  }

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(401).json(new ApiResponse(401, null, "Current password is incorrect"));
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
});

// GET /api/user/addresses
export const getAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("addresses");
  return res.status(200).json(new ApiResponse(200, { addresses: user.addresses }, "Addresses fetched"));
});

// POST /api/user/addresses
export const addAddress = asyncHandler(async (req, res) => {
  try {
    const { firstName, lastName, phone, address, city, state, zip, isDefault } = req.body;

    if (!firstName || !lastName || !phone || !address || !city || !state || !zip) {
      return res.status(400).json(new ApiResponse(400, null, "All address fields are required"));
    }

    const user = await User.findById(req.user._id);

    if (isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    user.addresses.push({ firstName, lastName, phone, address, city, state, zip, isDefault: !!isDefault });
    await user.save({ validateBeforeSave: false });

    return res.status(201).json(new ApiResponse(201, { addresses: user.addresses }, "Address added successfully"));
  } catch (err) {
    return handleMongoErrors(err, res);
  }
});

// PUT /api/user/addresses/:addressId
export const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const addr = user.addresses.id(req.params.addressId);

  if (!addr) {
    return res.status(404).json(new ApiResponse(404, null, "Address not found"));
  }

  const fields = ["firstName", "lastName", "phone", "address", "city", "state", "zip"];
  fields.forEach((f) => { if (req.body[f] !== undefined) addr[f] = req.body[f]; });

  if (req.body.isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
    addr.isDefault = true;
  }

  await user.save({ validateBeforeSave: false });
  return res.status(200).json(new ApiResponse(200, { addresses: user.addresses }, "Address updated successfully"));
});

// DELETE /api/user/addresses/:addressId
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const addr = user.addresses.id(req.params.addressId);

  if (!addr) {
    return res.status(404).json(new ApiResponse(404, null, "Address not found"));
  }

  addr.deleteOne();
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, { addresses: user.addresses }, "Address deleted successfully"));
});
