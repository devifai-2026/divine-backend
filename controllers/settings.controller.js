import Setting from "../models/setting.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { clearShiprocketCache } from "../utils/shiprocket.js";

// GET /api/settings/shipping  — public, no auth (used by frontend)
export const getPublicShipping = asyncHandler(async (req, res) => {
  const s = await Setting.findOne().lean();
  return res.status(200).json(
    new ApiResponse(200, {
      freeThreshold: s?.shipping?.freeThreshold ?? 2000,
      charge:        s?.shipping?.charge        ?? 150,
      gstPercent:    s?.shipping?.gstPercent    ?? 18,
    }, "Shipping config fetched")
  );
});

// GET /api/admin/settings
export const getSettings = asyncHandler(async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) {
    setting = await Setting.create({
      shiprocket: {
        email:          process.env.SHIPROCKET_EMAIL || "",
        password:       process.env.SHIPROCKET_PASSWORD || "",
        pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
      },
      shipping: { freeThreshold: 2000, charge: 150, gstPercent: 18 },
    });
  }

  return res.status(200).json(
    new ApiResponse(200, {
      shiprocket: {
        email:          setting.shiprocket.email,
        password:       setting.shiprocket.password ? "••••••••" : "",
        pickupLocation: setting.shiprocket.pickupLocation,
        hasPassword:    !!setting.shiprocket.password,
      },
      shipping: {
        freeThreshold: setting.shipping?.freeThreshold ?? 2000,
        charge:        setting.shipping?.charge        ?? 150,
        gstPercent:    setting.shipping?.gstPercent    ?? 18,
      },
    }, "Settings fetched")
  );
});

// PATCH /api/admin/settings/shipping
export const updateShippingSettings = asyncHandler(async (req, res) => {
  const { freeThreshold, charge, gstPercent } = req.body;

  if (freeThreshold == null || charge == null || gstPercent == null) {
    return res.status(400).json(new ApiResponse(400, null, "freeThreshold, charge, and gstPercent are required"));
  }

  const setting = await Setting.findOneAndUpdate(
    {},
    {
      $set: {
        "shipping.freeThreshold": Number(freeThreshold),
        "shipping.charge":        Number(charge),
        "shipping.gstPercent":    Number(gstPercent),
      },
    },
    { upsert: true, new: true }
  );

  return res.status(200).json(
    new ApiResponse(200, {
      freeThreshold: setting.shipping.freeThreshold,
      charge:        setting.shipping.charge,
      gstPercent:    setting.shipping.gstPercent,
    }, "Shipping settings updated")
  );
});

// PATCH /api/admin/settings/shiprocket
export const updateShiprocketSettings = asyncHandler(async (req, res) => {
  const { email, password, pickupLocation } = req.body;

  if (!email || !pickupLocation) {
    return res.status(400).json(new ApiResponse(400, null, "Email and pickup location are required"));
  }

  const update = {
    "shiprocket.email":          email.trim(),
    "shiprocket.pickupLocation": pickupLocation.trim(),
  };

  // Only update password if a new one was provided (non-empty)
  if (password && password !== "••••••••") {
    update["shiprocket.password"] = password;
  }

  const setting = await Setting.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true }
  );

  // Clear Shiprocket token cache so next request uses new credentials
  clearShiprocketCache();

  return res.status(200).json(
    new ApiResponse(200, {
      shiprocket: {
        email:          setting.shiprocket.email,
        pickupLocation: setting.shiprocket.pickupLocation,
        hasPassword:    !!setting.shiprocket.password,
      },
    }, "Shiprocket settings updated")
  );
});
