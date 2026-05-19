import axios from "axios";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiresAt = null;

// Settings cache — refreshed every 5 minutes so DB changes apply quickly
let settingsCache = null;
let settingsCacheExpiry = null;
const SETTINGS_TTL = 5 * 60 * 1000;

export const clearShiprocketCache = () => {
  cachedToken = null;
  tokenExpiresAt = null;
  settingsCache = null;
  settingsCacheExpiry = null;
  console.log("[Shiprocket] Cache cleared — will re-authenticate with updated credentials");
};

const getCredentials = async () => {
  if (settingsCache && settingsCacheExpiry && Date.now() < settingsCacheExpiry) {
    return settingsCache;
  }

  try {
    const { default: Setting } = await import("../models/setting.model.js");
    const setting = await Setting.findOne().lean();
    if (setting?.shiprocket?.email && setting?.shiprocket?.password) {
      settingsCache = {
        email:          setting.shiprocket.email,
        password:       setting.shiprocket.password,
        pickupLocation: setting.shiprocket.pickupLocation || "Primary",
      };
      settingsCacheExpiry = Date.now() + SETTINGS_TTL;
      return settingsCache;
    }
  } catch (err) {
    console.warn("[Shiprocket] Could not load settings from DB, falling back to .env:", err.message);
  }

  // Fallback to .env
  const creds = {
    email:          process.env.SHIPROCKET_EMAIL,
    password:       process.env.SHIPROCKET_PASSWORD,
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
  };
  settingsCache = creds;
  settingsCacheExpiry = Date.now() + SETTINGS_TTL;
  return creds;
};

const getToken = async () => {
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  cachedToken = null;
  tokenExpiresAt = null;

  const { email, password } = await getCredentials();

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });

    if (!res.data?.token) {
      throw new Error(`Shiprocket login succeeded but returned no token. Response: ${JSON.stringify(res.data)}`);
    }

    cachedToken = res.data.token;
    tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000 + 55 * 60 * 1000;
    console.log("[Shiprocket] Token refreshed successfully");
    return cachedToken;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`[Shiprocket] AUTH FAILED — status ${status}:`, body || err.message);
    throw new Error(`Shiprocket authentication failed (${status}): ${body?.message || err.message}`);
  }
};

export const shiprocket = async (method, endpoint, data = null) => {
  const token = await getToken();
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    };
    if (data) config.data = data;
    const res = await axios(config);
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`[Shiprocket] API call failed — ${method} ${endpoint} — status ${status}:`, body || err.message);
    throw err;
  }
};

export const getShiprocketPickupLocation = async () => {
  const { pickupLocation } = await getCredentials();
  return pickupLocation;
};
