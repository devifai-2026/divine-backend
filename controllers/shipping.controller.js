import { shiprocket, getShiprocketPickupLocation } from "../utils/shiprocket.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// Shiprocket status_id → our order status + description
const SHIPROCKET_STATUS_MAP = {
  1:  { status: null,          label: "Order pending" },
  2:  { status: null,          label: "Order confirmed by Shiprocket" },
  3:  { status: "Processing",  label: "Pickup scheduled" },
  4:  { status: "Processing",  label: "Package picked up by courier" },
  5:  { status: "Processing",  label: "Pickup error — rescheduling" },
  6:  { status: "Shipped",     label: "In transit" },
  7:  { status: "Shipped",     label: "Out for delivery" },
  8:  { status: "Delivered",   label: "Delivered to customer" },
  9:  { status: "Cancelled",   label: "Shipment cancelled" },
  10: { status: "Cancelled",   label: "Return in transit (RTO)" },
  11: { status: "Cancelled",   label: "Returned to origin (RTO)" },
  13: { status: "Processing",  label: "Pickup rescheduled" },
  14: { status: "Processing",  label: "Pickup queued" },
  15: { status: "Shipped",     label: "Shipment held at facility" },
};

const ORDER_RANK = { Processing: 1, Shipped: 2, Delivered: 3, Cancelled: 4 };

// Resolve orderId param: supports both MongoDB _id and friendly "ORD-xxx" string
const buildOrderQuery = (orderId) =>
  orderId.startsWith("ORD-") ? { orderId } : { _id: orderId };

// POST /api/shipping/webhook?token=SECRET  — called by Shiprocket on every courier scan
export const handleShiprocketWebhook = asyncHandler(async (req, res) => {
  if (req.query.token !== process.env.SHIPROCKET_WEBHOOK_TOKEN) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const {
    awb,
    current_status_id,
    current_status,
    city,
    state,
    activity_description,
    etd,
  } = req.body;

  if (!awb) return res.status(400).json({ message: "AWB missing" });

  const order = await Order.findOne({ awbCode: awb });
  if (!order) {
    return res.status(200).json({ received: true });
  }

  const mapped = SHIPROCKET_STATUS_MAP[current_status_id];
  const newStatus = mapped?.status ?? null;
  const description = mapped?.label || current_status || "Status updated";

  const location = [city, state].filter(Boolean).join(", ");
  const timelineDescription = location ? `${description} — ${location}` : description;

  order.timeline.push({
    status: newStatus || order.status,
    description: timelineDescription,
    timestamp: new Date(),
  });

  const currentRank = ORDER_RANK[order.status] ?? 0;
  const newRank = newStatus ? (ORDER_RANK[newStatus] ?? 0) : 0;

  if (newStatus && newRank > currentRank) {
    order.status = newStatus;
  }

  if (newStatus === "Delivered" && order.paymentStatus !== "completed") {
    order.paymentStatus = "completed";
    const karmaPoints = Math.floor(order.total / 100);
    if (karmaPoints > 0) {
      await User.findByIdAndUpdate(order.user, { $inc: { karmaPoints } });
    }
  }

  if (etd) order.edd = etd;

  await order.save({ validateBeforeSave: false });

  return res.status(200).json({ received: true });
});

// Called internally after payment is verified — not exposed as HTTP endpoint
export const createShiprocketShipment = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  // Partial success recovery: Shiprocket order already created but AWB not yet assigned
  if (order.shiprocketOrderId && order.shipmentId && !order.awbCode) {
    console.log(`[Shiprocket] Order ${order.orderId} already exists (shipment ${order.shipmentId}), attempting AWB assignment`);
    try {
      const assignResult = await shiprocket("POST", "/courier/assign/awb", {
        shipment_id: [order.shipmentId],
      });
      const awb =
        assignResult?.awb_code ||
        assignResult?.response?.data?.awb_code ||
        assignResult?.data?.awb_code;
      const courier =
        assignResult?.courier_name ||
        assignResult?.response?.data?.courier_name ||
        assignResult?.data?.courier_name;
      if (awb) {
        order.awbCode = awb;
        if (courier) order.courierName = courier;
        console.log(`[Shiprocket] AWB assigned on retry: ${awb} via ${courier}`);
        await order.save({ validateBeforeSave: false });
      } else {
        console.warn(`[Shiprocket] AWB assignment returned no AWB for shipment ${order.shipmentId}`);
      }
    } catch (err) {
      console.error(`[Shiprocket] AWB re-assign failed for shipment ${order.shipmentId}:`, err?.response?.data || err.message);
      throw err;
    }
    return;
  }

  // Already fully created — nothing to do
  if (order.shiprocketOrderId && order.awbCode) {
    console.log(`[Shiprocket] Order ${order.orderId} already has AWB ${order.awbCode}, skipping`);
    return;
  }

  const addr = order.shippingAddress;

  const payload = {
    order_id: order.orderId,
    order_date: order.createdAt.toISOString().split("T")[0],
    pickup_location: await getShiprocketPickupLocation(),
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

  const result = await shiprocket("POST", "/orders/create/adhoc", payload);

  order.shiprocketOrderId = result.order_id;
  order.shipmentId = result.shipment_id?.toString() || "";
  order.awbCode = result.awb_code || "";
  order.courierName = result.courier_name || "";

  // Shiprocket sometimes doesn't assign a courier immediately — request AWB assignment
  if (!order.awbCode && order.shipmentId) {
    try {
      const assignResult = await shiprocket("POST", "/courier/assign/awb", {
        shipment_id: [order.shipmentId],
      });
      // Shiprocket response shape varies; try common paths
      const awb =
        assignResult?.awb_code ||
        assignResult?.response?.data?.awb_code ||
        assignResult?.data?.awb_code;
      const courier =
        assignResult?.courier_name ||
        assignResult?.response?.data?.courier_name ||
        assignResult?.data?.courier_name;

      if (awb) {
        order.awbCode = awb;
        if (courier) order.courierName = courier;
        console.log(`[Shiprocket] AWB assigned: ${order.awbCode} via ${order.courierName}`);
      } else {
        console.warn(`[Shiprocket] Courier assignment returned no AWB for shipment ${order.shipmentId}`);
      }
    } catch (err) {
      console.error(
        `[Shiprocket] AWB auto-assign failed for shipment ${order.shipmentId}:`,
        err?.response?.data || err.message
      );
    }
  }

  await order.save({ validateBeforeSave: false });

  return result;
};

// GET /api/shipping/track/:awb  — user tracks their own shipment by AWB/tracking number
export const trackShipment = asyncHandler(async (req, res) => {
  const { awb } = req.params;

  // Verify the AWB belongs to the authenticated user's order
  const order = await Order.findOne({ awbCode: awb, user: req.user._id });
  if (!order) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No order found with this tracking number"));
  }

  let liveTracking = null;
  try {
    liveTracking = await shiprocket("GET", `/courier/track/awb/${awb}`);
  } catch {
    // Return local timeline if Shiprocket is unavailable
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        awbCode: order.awbCode,
        courierName: order.courierName,
        edd: order.edd,
        timeline: order.timeline,
        liveTracking,
      },
      "Shipment tracking fetched"
    )
  );
});

// GET /api/shipping/order/:orderId  — user's shipment status (supports _id OR ORD-xxx)
export const getShipmentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    ...buildOrderQuery(orderId),
    user: req.user._id,
  });

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  if (!order.awbCode) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orderId: order.orderId,
          status: order.status,
          awbCode: null,
          timeline: order.timeline,
        },
        "Shipment not yet dispatched"
      )
    );
  }

  let liveTracking = null;
  try {
    liveTracking = await shiprocket("GET", `/courier/track/awb/${order.awbCode}`);
  } catch {
    // local data still returned
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        awbCode: order.awbCode,
        courierName: order.courierName,
        edd: order.edd,
        timeline: order.timeline,
        liveTracking,
      },
      "Shipment status fetched"
    )
  );
});

// GET /api/admin/orders/:orderId/track  — admin tracks any order (supports _id OR ORD-xxx)
export const getAdminShipmentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne(buildOrderQuery(orderId)).populate("user", "name email phone");

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  if (!order.awbCode) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          status: "not_shipped",
          order: {
            orderId: order.orderId,
            status: order.status,
            shiprocketOrderId: order.shiprocketOrderId,
            timeline: order.timeline,
            user: order.user,
          },
        },
        "Shipment not yet created for this order"
      )
    );
  }

  let liveTracking = null;
  try {
    liveTracking = await shiprocket("GET", `/courier/track/awb/${order.awbCode}`);
  } catch {
    // local data still returned
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        awbCode: order.awbCode,
        courierName: order.courierName,
        edd: order.edd,
        shiprocketOrderId: order.shiprocketOrderId,
        shipmentId: order.shipmentId,
        timeline: order.timeline,
        shippingAddress: order.shippingAddress,
        user: order.user,
        total: order.total,
        paymentStatus: order.paymentStatus,
        liveTracking,
      },
      "Shipment status fetched"
    )
  );
});

// GET /api/admin/orders/track-awb/:awb  — admin searches and tracks any order by AWB
export const adminTrackByAwb = asyncHandler(async (req, res) => {
  const { awb } = req.params;

  const order = await Order.findOne({ awbCode: awb }).populate("user", "name email phone");
  if (!order) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, `No order found with AWB: ${awb}`));
  }

  let liveTracking = null;
  try {
    liveTracking = await shiprocket("GET", `/courier/track/awb/${awb}`);
  } catch {
    // local data still returned
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        awbCode: order.awbCode,
        courierName: order.courierName,
        edd: order.edd,
        shiprocketOrderId: order.shiprocketOrderId,
        shipmentId: order.shipmentId,
        timeline: order.timeline,
        shippingAddress: order.shippingAddress,
        user: order.user,
        total: order.total,
        paymentStatus: order.paymentStatus,
        liveTracking,
      },
      "Admin: shipment tracked by AWB"
    )
  );
});

// POST /api/shipping/cancel/:orderId  — cancel Shiprocket shipment (Admin)
export const cancelShipment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));
  }

  if (!order.shiprocketOrderId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "No Shiprocket shipment found for this order"));
  }

  const data = await shiprocket("POST", "/orders/cancel", {
    ids: [order.shiprocketOrderId],
  });

  return res.status(200).json(new ApiResponse(200, data, "Shipment cancelled on Shiprocket"));
});

// GET /api/shipping/serviceability?pickup_postcode=&delivery_postcode=&weight=&cod=
export const checkServiceability = asyncHandler(async (req, res) => {
  const { pickup_postcode, delivery_postcode, weight = 0.5, cod = 0 } = req.query;

  if (!pickup_postcode || !delivery_postcode) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "pickup_postcode and delivery_postcode are required"));
  }

  const data = await shiprocket(
    "GET",
    `/courier/serviceability/?pickup_postcode=${pickup_postcode}&delivery_postcode=${delivery_postcode}&weight=${weight}&cod=${cod}`
  );

  return res.status(200).json(new ApiResponse(200, data, "Serviceability fetched"));
});

// GET /api/shipping/test-auth  — admin only, verify Shiprocket credentials work
export const testShiprocketAuth = asyncHandler(async (req, res) => {
  try {
    const data = await shiprocket("GET", "/settings/company/pickup");
    const configuredLocation = await getShiprocketPickupLocation();
    // Shiprocket returns { shipping_address: [...] }
    const locationList = data?.shipping_address ?? data?.data ?? [];
    const locationNames = Array.isArray(locationList)
      ? locationList.map((l) => l.pickup_location || l.name).filter(Boolean)
      : [];
    const isValid = locationNames.length === 0 || locationNames.includes(configuredLocation);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          shiprocketEmail: process.env.SHIPROCKET_EMAIL,
          configuredPickupLocation: configuredLocation,
          pickupLocationValid: isValid,
          availablePickupLocations: locationNames,
        },
        isValid
          ? "Shiprocket connected — pickup location OK"
          : `⚠️  Pickup location "${configuredLocation}" not found in Shiprocket account — update SHIPROCKET_PICKUP_LOCATION in .env`
      )
    );
  } catch (err) {
    return res.status(500).json(
      new ApiResponse(
        500,
        { error: err.message },
        "Shiprocket auth failed — check credentials or account plan"
      )
    );
  }
});

// POST /api/shipping/create/:orderId  — Admin manually triggers Shiprocket shipment creation (retry)
export const adminCreateShipment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  if (order.paymentStatus !== "completed") {
    return res.status(400).json(new ApiResponse(400, null, "Payment not completed — cannot create shipment"));
  }

  if (order.awbCode) {
    return res.status(400).json(
      new ApiResponse(400, { awbCode: order.awbCode, courierName: order.courierName }, "Shipment already created for this order")
    );
  }

  try {
    await createShiprocketShipment(order._id);
  } catch (err) {
    const srMsg = err?.response?.data?.message || err?.response?.data?.errors || err.message || "Unknown Shiprocket error";
    console.error(`[Shiprocket] Admin create failed for order ${order.orderId}:`, srMsg);
    return res.status(502).json(
      new ApiResponse(502, { shiprocketError: srMsg }, `Shiprocket shipment creation failed: ${srMsg}`)
    );
  }

  const updated = await Order.findById(order._id);
  return res.status(200).json(
    new ApiResponse(200, {
      orderId: updated.orderId,
      awbCode: updated.awbCode,
      courierName: updated.courierName,
      shipmentId: updated.shipmentId,
    }, updated.awbCode ? "Shipment created successfully" : "Shipment created but AWB not assigned yet — check Shiprocket dashboard")
  );
});

// POST /api/shipping/mock-shipment/:orderId  — DEV/TEST only, bypasses Shiprocket
export const mockShipment = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json(new ApiResponse(403, null, "Not available in production"));
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  const awbCode = req.body.awbCode || `TEST-AWB-${Date.now()}`;
  const courierName = req.body.courierName || "Test Courier";

  order.awbCode = awbCode;
  order.courierName = courierName;
  order.shiprocketOrderId = `MOCK-${Date.now()}`;
  order.shipmentId = `MOCK-SHIP-${Date.now()}`;
  order.status = "Shipped";
  order.timeline.push({
    status: "Shipped",
    description: `Package picked up by ${courierName} — AWB: ${awbCode}`,
    timestamp: new Date(),
  });

  await order.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        awbCode: order.awbCode,
        courierName: order.courierName,
        status: order.status,
      },
      "Mock shipment created — use this AWB to test tracking"
    )
  );
});

// POST /api/shipping/mock-webhook  — DEV/TEST only, simulates a Shiprocket courier scan
export const mockWebhook = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json(new ApiResponse(403, null, "Not available in production"));
  }

  const { awb, current_status_id, current_status, city, activity_description } = req.body;
  if (!awb) return res.status(400).json(new ApiResponse(400, null, "awb is required"));

  const order = await Order.findOne({ awbCode: awb });
  if (!order)
    return res
      .status(404)
      .json(new ApiResponse(404, null, `No order found with AWB: ${awb}`));

  const mapped = SHIPROCKET_STATUS_MAP[current_status_id];
  const newStatus = mapped?.status ?? null;
  const description = mapped?.label || current_status || "Status updated";
  const timelineDescription = city ? `${description} — ${city}` : description;

  order.timeline.push({
    status: newStatus || order.status,
    description: timelineDescription,
    timestamp: new Date(),
  });

  if (newStatus && (ORDER_RANK[newStatus] ?? 0) > (ORDER_RANK[order.status] ?? 0)) {
    order.status = newStatus;
  }

  if (newStatus === "Delivered" && order.paymentStatus !== "completed") {
    order.paymentStatus = "completed";
    const karmaPoints = Math.floor(order.total / 100);
    if (karmaPoints > 0)
      await User.findByIdAndUpdate(order.user, { $inc: { karmaPoints } });
  }

  await order.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.orderId,
        status: order.status,
        timeline: order.timeline,
      },
      `Mock webhook applied — order is now "${order.status}"`
    )
  );
});
