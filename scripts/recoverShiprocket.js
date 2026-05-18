/**
 * Run: node scripts/recoverShiprocket.js
 *
 * Finds all paid orders with no Shiprocket shipment and creates/syncs them.
 * Safe to run multiple times — skips orders that already have a shiprocketOrderId.
 */

import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

let _token = null;
async function getToken() {
  if (_token) return _token;
  const res = await axios.post(`${SR_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });
  _token = res.data.token;
  return _token;
}

async function srPost(endpoint, data) {
  const token = await getToken();
  const res = await axios.post(`${SR_BASE}${endpoint}`, data, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return res.data;
}

async function srGet(endpoint) {
  const token = await getToken();
  const res = await axios.get(`${SR_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false, timestamps: true }));

  // Find all paid orders with no Shiprocket ID
  const orders = await Order.find({
    paymentStatus: "completed",
    $or: [{ shiprocketOrderId: "" }, { shiprocketOrderId: { $exists: false } }],
  }).lean();

  if (!orders.length) {
    console.log("✅ All paid orders already have Shiprocket shipments.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${orders.length} order(s) needing Shiprocket shipment.\n`);

  for (const order of orders) {
    console.log(`\n── Processing: ${order.orderId} ──`);
    const addr = order.shippingAddress || {};

    const payload = {
      order_id: order.orderId,
      order_date: new Date(order.createdAt).toISOString().split("T")[0],
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
      billing_customer_name: addr.firstName || "Customer",
      billing_last_name: addr.lastName || "",
      billing_address: addr.address || "",
      billing_city: addr.city || "",
      billing_pincode: addr.zip || "",
      billing_state: addr.state || "",
      billing_country: "India",
      billing_email: addr.email || "",
      billing_phone: addr.phone || "",
      shipping_is_billing: true,
      order_items: (order.items || []).map((item) => ({
        name: item.name,
        sku: item.product ? item.product.toString() : item.name.replace(/\s+/g, "-").toLowerCase(),
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: "Prepaid",
      sub_total: order.total,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    let srData;
    try {
      srData = await srPost("/orders/create/adhoc", payload);
      console.log(`  ✅ Shiprocket order created — ID: ${srData.order_id}, Shipment: ${srData.shipment_id}`);
    } catch (err) {
      const body = err.response?.data;
      // Duplicate order — fetch existing shipment from Shiprocket
      if (err.response?.status === 422 || body?.message?.toLowerCase().includes("already")) {
        console.log("  ⚠️  Order already exists on Shiprocket — fetching existing data...");
        try {
          const search = await srGet(`/orders/show/${order.orderId}`);
          srData = search?.data;
          if (!srData?.id) throw new Error("Could not find existing Shiprocket order");
          srData = { order_id: srData.id, shipment_id: srData.shipments?.[0]?.id, awb_code: srData.shipments?.[0]?.awb_code || "", courier_name: srData.shipments?.[0]?.courier?.name || "" };
          console.log(`  ✅ Fetched existing — Shiprocket ID: ${srData.order_id}`);
        } catch (fetchErr) {
          console.error("  ❌ Could not fetch existing Shiprocket order:", fetchErr.message);
          continue;
        }
      } else {
        console.error(`  ❌ Failed: HTTP ${err.response?.status}`, body);
        continue;
      }
    }

    // Try to assign AWB if not already set
    let awbCode = srData.awb_code || "";
    let courierName = srData.courier_name || "";

    if (!awbCode && srData.shipment_id) {
      console.log("  Assigning AWB to shipment...");
      try {
        const assignRes = await srPost("/courier/assign/awb", {
          shipment_id: [srData.shipment_id],
        });
        awbCode    = assignRes?.awb_code    || assignRes?.response?.data?.awb_code    || assignRes?.data?.awb_code    || "";
        courierName = assignRes?.courier_name || assignRes?.response?.data?.courier_name || assignRes?.data?.courier_name || "";
        if (awbCode) {
          console.log(`  ✅ AWB assigned: ${awbCode} via ${courierName}`);
        } else {
          console.warn("  ⚠️  AWB not assigned yet — will be assigned by Shiprocket automatically");
        }
      } catch (awbErr) {
        console.warn("  ⚠️  AWB assignment failed:", awbErr.response?.data || awbErr.message);
      }
    } else if (awbCode) {
      console.log(`  AWB already set: ${awbCode}`);
    }

    // Save back to MongoDB
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          shiprocketOrderId: String(srData.order_id || ""),
          shipmentId: String(srData.shipment_id || ""),
          awbCode,
          courierName,
        },
      }
    );
    console.log(`  💾 DB updated for ${order.orderId}`);
  }

  console.log("\nRecovery complete.\n");
  await mongoose.disconnect();
}

run().catch(console.error);
