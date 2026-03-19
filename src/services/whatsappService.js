import dayjs from "dayjs";

import { normalizePhone } from "../utils/normalizers.js";

function getConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v22.0",
  };
}

export function isWhatsAppConfigured() {
  const { accessToken, phoneNumberId } = getConfig();
  return Boolean(accessToken && phoneNumberId);
}

export async function sendWhatsAppText({ to, text }) {
  const config = getConfig();
  if (!isWhatsAppConfigured()) {
    return { sent: false, skipped: true, reason: "whatsapp_not_configured" };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: normalizePhone(to).replace(/^\+/, ""),
    type: "text",
    text: {
      body: text,
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    return { sent: false, error: data };
  }

  return { sent: true, data };
}

export async function sendRegistrationOnboardingMessage({
  to,
  fullName,
  registrationToken,
  expiresAt,
}) {
  const onboardingBaseUrl = process.env.REGISTRATION_CONTINUE_URL || "";
  const linkSuffix = onboardingBaseUrl
    ? `\nContinue registration: ${onboardingBaseUrl}?token=${registrationToken}`
    : `\nUse this token to complete signup: ${registrationToken}`;

  const text =
    `Hi ${fullName}, welcome to Thai Residency.` +
    `\nYour registration has started and is waiting for completion.` +
    `\nThis step expires at ${dayjs(expiresAt).format("DD MMM YYYY, hh:mm A")}.` +
    linkSuffix;

  return sendWhatsAppText({ to, text });
}

export async function sendBookingConfirmationMessage({ to, fullName, booking }) {
  const text =
    `Hi ${fullName}, your booking is confirmed.` +
    `\nBooking ID: ${booking.bookingCode}` +
    `\nCheck-in: ${dayjs(booking.checkIn).format("DD MMM YYYY")}` +
    `\nCheck-out: ${dayjs(booking.checkOut).format("DD MMM YYYY")}` +
    `\nAmount Paid: ${booking.currency} ${booking.amount}` +
    `\nThank you for choosing Thai Residency.`;

  return sendWhatsAppText({ to, text });
}
