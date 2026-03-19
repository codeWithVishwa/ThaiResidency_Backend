import { sendWhatsAppText } from "../services/whatsappService.js";

function buildBotReply(rawMessage) {
  const text = (rawMessage || "").toLowerCase();

  if (text.includes("booking")) {
    return "To check or confirm your booking, please share your booking ID (example: TR-123ABC).";
  }
  if (text.includes("price") || text.includes("room")) {
    return "You can view available rooms and prices in the app. If you need help, type HELP.";
  }
  if (text.includes("help")) {
    return "Thai Residency support: reply with BOOKING for booking help, or call reception for urgent issues.";
  }

  return "Welcome to Thai Residency. Reply BOOKING for reservation support or HELP for more options.";
}

export async function verifyWhatsappWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    verifyToken &&
    verifyToken === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: "Webhook verification failed" });
}

export async function handleWhatsappWebhook(req, res) {
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change.value || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const message of messages) {
        const from = message.from;
        const body = message?.text?.body || "";
        if (!from) continue;

        const reply = buildBotReply(body);
        try {
          await sendWhatsAppText({
            to: from,
            text: reply,
          });
        } catch (_error) {
          // Webhook should still acknowledge receipt.
        }
      }
    }
  }

  res.status(200).json({ success: true });
}
