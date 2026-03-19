import crypto from "crypto";

import ApiError from "../utils/apiError.js";

function getRazorpayConfig() {
  const keyId = process.env.RZP_KEY_ID;
  const keySecret = process.env.RZP_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new ApiError(
      500,
      "Razorpay is not configured. Add RZP_KEY_ID and RZP_KEY_SECRET.",
    );
  }

  return { keyId, keySecret };
}

export function getRazorpayPublicConfig() {
  return {
    keyId: process.env.RZP_KEY_ID || null,
    currency: process.env.CURRENCY || "INR",
  };
}

export async function createRazorpayOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const { keyId, keySecret } = getRazorpayConfig();

  const authToken = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(502, "Unable to create Razorpay order", data);
  }

  return data;
}

export function verifyRazorpayPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const { keySecret } = getRazorpayConfig();

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return generatedSignature === razorpaySignature;
}
