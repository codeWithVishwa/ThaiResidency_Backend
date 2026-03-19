import dayjs from "dayjs";

import Booking from "../models/Booking.js";
import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
  verifyRazorpayPaymentSignature,
} from "../services/razorpayService.js";
import { sendBookingConfirmationMessage } from "../services/whatsappService.js";
import ApiError from "../utils/apiError.js";

function ensureBookingOwnerOrThrow(booking, userId) {
  if (String(booking.user) !== String(userId)) {
    throw new ApiError(403, "You do not have access to this booking payment");
  }
}

export async function getPaymentConfig(_req, res) {
  res.json({
    success: true,
    data: getRazorpayPublicConfig(),
  });
}

export async function createBookingOrder(req, res) {
  const bookingId = String(req.body.bookingId);

  const booking = await Booking.findById(bookingId).populate("room", "name");
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  ensureBookingOwnerOrThrow(booking, req.user._id);

  if (booking.paymentMode !== "razorpay") {
    throw new ApiError(409, "This booking is configured as pay-at-hotel");
  }

  if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
    return res.json({
      success: true,
      message: "Booking is already paid",
      data: {
        booking,
      },
    });
  }

  if (booking.status !== "pending_payment") {
    throw new ApiError(409, `Booking cannot be paid in '${booking.status}' status`);
  }

  if (booking.paymentDueAt && dayjs(booking.paymentDueAt).isBefore(dayjs())) {
    booking.status = "payment_failed";
    booking.paymentStatus = "failed";
    await booking.save();
    throw new ApiError(410, "Payment window expired. Please create a new booking.");
  }

  const amountPaise = Math.round(booking.amount * 100);
  const order = await createRazorpayOrder({
    amount: amountPaise,
    currency: booking.currency || "INR",
    receipt: booking.bookingCode,
    notes: {
      bookingId: String(booking._id),
      roomName: booking.room?.name || "",
    },
  });

  booking.razorpayOrderId = order.id;
  await booking.save();

  const config = getRazorpayPublicConfig();
  res.json({
    success: true,
    message: "Razorpay order created",
    data: {
      bookingId: booking._id,
      razorpayKeyId: config.keyId,
      order,
    },
  });
}

export async function verifyBookingPayment(req, res) {
  const bookingId = String(req.body.bookingId);
  const razorpayOrderId = String(req.body.razorpayOrderId);
  const razorpayPaymentId = String(req.body.razorpayPaymentId);
  const razorpaySignature = String(req.body.razorpaySignature);

  const booking = await Booking.findById(bookingId).populate("room", "name");
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  ensureBookingOwnerOrThrow(booking, req.user._id);

  if (booking.paymentMode !== "razorpay") {
    throw new ApiError(409, "This booking does not require online payment verification");
  }

  if (booking.paymentStatus === "paid" && booking.status === "confirmed") {
    return res.json({
      success: true,
      message: "Payment already verified",
      data: { booking },
    });
  }

  if (!booking.razorpayOrderId) {
    throw new ApiError(409, "Payment order not found for this booking");
  }

  if (booking.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(422, "Razorpay order ID does not match booking order");
  }

  const isValidSignature = verifyRazorpayPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isValidSignature) {
    booking.status = "payment_failed";
    booking.paymentStatus = "failed";
    booking.razorpayPaymentId = razorpayPaymentId;
    booking.razorpaySignature = razorpaySignature;
    await booking.save();
    throw new ApiError(400, "Invalid payment signature");
  }

  booking.status = "confirmed";
  booking.paymentStatus = "paid";
  booking.paymentDueAt = null;
  booking.razorpayPaymentId = razorpayPaymentId;
  booking.razorpaySignature = razorpaySignature;
  await booking.save();

  try {
    await sendBookingConfirmationMessage({
      to: req.user.phone,
      fullName: req.user.fullName,
      booking,
    });
  } catch (_error) {
    // Booking is confirmed regardless of WhatsApp delivery result.
  }

  res.json({
    success: true,
    message: "Payment verified and booking confirmed",
    data: { booking },
  });
}
