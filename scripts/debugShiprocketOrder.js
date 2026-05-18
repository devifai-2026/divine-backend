/**
 * Run: node scripts/debugShiprocketOrder.js
 * Takes the latest paid order and tries to create a Shiprocket shipment — prints the exact error.
 */

import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

async function getToken() {
  const res = await axios.post(`${SR_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });
  return res.data.token;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
  const order = await Order.findOne({ paymentStatus: "completed", shiprocketOrderId: "" })
    .sort({ createdAt: -1 })
    .lean();

  if (!order) {
    console.log("No eligible orders found.");
    return;
  }

  console.log("\nTrying order:", order.orderId);
  console.log("Shipping Address:", JSON.stringify(order.shippingAddress, null, 2));
  console.log("Items:", JSON.stringify(order.items, null, 2));

  const addr = order.shippingAddress;
  const payload = {
    order_id: order.orderId,
    order_date: new Date(order.createdAt).toISOString().split("T")[0],
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    billing_customer_name: addr.firstName,
    billing_last_name: addr.lastName,
    billing_address: addr.address,
    billing_city: addr.city,
    billing_pincode: addr.zip,
    billing_state: addr.state,
    billing_country: "India",
    billing_email: addr.email,
    billing_phone: addr.phone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
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

  console.log("\nPayload to Shiprocket:", JSON.stringify(payload, null, 2));

  const token = await getToken();

  try {
    const res = await axios.post(`${SR_BASE}/orders/create/adhoc`, payload, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    console.log("\n✅ Shiprocket order created!");
    console.log("Response:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("\n❌ Shiprocket order creation FAILED");
    console.error("HTTP Status:", err.response?.status);
    console.error("Error body:", JSON.stringify(err.response?.data, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
