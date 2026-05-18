/**
 * Run: node scripts/checkShiprocket.js
 *
 * Checks:
 *  1. Shiprocket login (credentials valid?)
 *  2. Pickup location exists
 *  3. Last 5 orders from DB — shows shiprocketOrderId / awbCode / courierName
 */

import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

// ── 1. Shiprocket auth ──────────────────────────────────────────────────────
async function testShiprocket() {
  console.log("\n=== 1. Shiprocket Auth ===");
  console.log(`Email : ${process.env.SHIPROCKET_EMAIL}`);

  let token;
  try {
    const res = await axios.post(`${SR_BASE}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });
    token = res.data?.token;
    if (!token) throw new Error("Login OK but no token returned");
    console.log("✅ Auth SUCCESS — token received");
  } catch (err) {
    const status = err.response?.status;
    const body   = err.response?.data;
    console.error(`❌ Auth FAILED (HTTP ${status}):`, body || err.message);
    return null;
  }

  // ── 2. Pickup locations ───────────────────────────────────────────────────
  console.log("\n=== 2. Pickup Locations ===");
  try {
    const res = await axios.get(`${SR_BASE}/settings/company/pickup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const locations = res.data?.data?.shipping_address ?? [];
    if (!locations.length) {
      console.warn("⚠️  No pickup locations found — add one in Shiprocket dashboard");
    } else {
      console.log("Pickup locations:");
      locations.forEach((l) =>
        console.log(`  • ${l.pickup_location} — ${l.city}, ${l.state} (${l.pin_code})`)
      );
      const configured = process.env.SHIPROCKET_PICKUP_LOCATION;
      const match = locations.find(
        (l) => l.pickup_location?.toLowerCase() === configured?.toLowerCase()
      );
      if (match) {
        console.log(`✅ SHIPROCKET_PICKUP_LOCATION="${configured}" found`);
      } else {
        console.warn(`⚠️  SHIPROCKET_PICKUP_LOCATION="${configured}" NOT found in your account`);
        console.warn("    Fix: set SHIPROCKET_PICKUP_LOCATION to one of the names above");
      }
    }
  } catch (err) {
    console.error("❌ Could not fetch pickup locations:", err.response?.data || err.message);
  }

  return token;
}

// ── 3. Recent orders from DB ──────────────────────────────────────────────
async function checkOrders() {
  console.log("\n=== 3. Last 5 Orders (DB) ===");
  await mongoose.connect(process.env.MONGODB_URI);

  const Order = mongoose.model(
    "Order",
    new mongoose.Schema({}, { strict: false })
  );

  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  if (!orders.length) {
    console.log("No orders in DB yet.");
    return;
  }

  orders.forEach((o) => {
    const srId  = o.shiprocketOrderId || "—";
    const awb   = o.awbCode           || "—";
    const courier = o.courierName     || "—";
    const status  = o.status          || "—";
    const pay     = o.paymentStatus   || "—";

    console.log(`\nOrder: ${o.orderId}`);
    console.log(`  Status        : ${status}`);
    console.log(`  Payment       : ${pay}`);
    console.log(`  ShiprocketID  : ${srId}`);
    console.log(`  AWB           : ${awb}`);
    console.log(`  Courier       : ${courier}`);

    if (pay === "completed" && srId === "—") {
      console.warn("  ⚠️  Payment done but NO Shiprocket shipment — check backend logs for errors");
    } else if (pay === "completed" && awb === "—") {
      console.warn("  ⚠️  Shiprocket order created but NO AWB yet — courier not assigned yet");
    } else if (awb !== "—") {
      console.log("  ✅ Shipment created and AWB assigned");
    }
  });

  await mongoose.disconnect();
}

// ── main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    await testShiprocket();
    await checkOrders();
    console.log("\nDone.\n");
  } catch (err) {
    console.error("Unexpected error:", err.message);
    process.exit(1);
  }
})();
