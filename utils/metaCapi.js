import crypto from "crypto";
import axios from "axios";

const sha256 = (value) =>
  value
    ? crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex")
    : undefined;

const buildUserData = (user, shippingAddress, req) => {
  const addr = shippingAddress || {};
  const phone = (user?.phone || addr.phone || "").replace(/\D/g, "");
  const firstName = addr.firstName || user?.name?.split(" ")[0] || "";
  const lastName = addr.lastName || user?.name?.split(" ").slice(1).join(" ") || "";

  const data = {
    em: [sha256(user?.email)].filter(Boolean),
    ph: phone ? [sha256(phone)] : [],
    fn: firstName ? [sha256(firstName)] : [],
    ln: lastName ? [sha256(lastName)] : [],
    ct: addr.city ? [sha256(addr.city)] : [],
    st: addr.state ? [sha256(addr.state)] : [],
    zp: addr.zip ? [sha256(addr.zip)] : [],
    country: ["in"],
    client_ip_address:
      req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req?.ip,
    client_user_agent: req?.headers?.["user-agent"],
  };

  const fbc = req?.headers?.["x-fbc"] || req?.cookies?.["_fbc"];
  const fbp = req?.headers?.["x-fbp"] || req?.cookies?.["_fbp"];
  if (fbc) data.fbc = fbc;
  if (fbp) data.fbp = fbp;

  return data;
};

/**
 * Send a server-side event to Meta Conversions API.
 * Fire-and-forget — never await this at the call site.
 *
 * @param {Object} opts
 * @param {string} opts.eventName  - e.g. "Purchase"
 * @param {string} opts.eventId    - unique ID for dedup with browser pixel (use order.orderId)
 * @param {number} opts.value      - monetary value of the event
 * @param {string} [opts.currency] - ISO 4217 currency code, defaults to "INR"
 * @param {Array}  opts.contents   - [{id, quantity, item_price}]
 * @param {number} opts.numItems   - total quantity across all items
 * @param {Object} opts.user       - Mongoose user doc (email, phone, name)
 * @param {Object} opts.shippingAddress - order shippingAddress subdoc
 * @param {Object} opts.req        - Express request (for IP, user-agent, cookies)
 */
export const sendMetaEvent = async ({
  eventName,
  eventId,
  value,
  currency = "INR",
  contents,
  numItems,
  user,
  shippingAddress,
  req,
}) => {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) return;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: String(eventId),
        user_data: buildUserData(user, shippingAddress, req),
        custom_data: {
          value,
          currency,
          contents,
          content_type: "product",
          num_items: numItems,
        },
      },
    ],
  };

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      payload,
      { params: { access_token: accessToken } }
    );
  } catch (err) {
    console.error("[Meta CAPI]", err?.response?.data || err.message);
  }
};
