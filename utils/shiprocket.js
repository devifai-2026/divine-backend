import axios from "axios";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiresAt = null;

const getToken = async () => {
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Reset cache before attempting login
  cachedToken = null;
  tokenExpiresAt = null;

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    if (!res.data?.token) {
      throw new Error(`Shiprocket login succeeded but returned no token. Response: ${JSON.stringify(res.data)}`);
    }

    cachedToken = res.data.token;
    // Token valid for 24h — refresh 5 min before expiry
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
