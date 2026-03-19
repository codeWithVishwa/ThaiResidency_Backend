import crypto from "crypto";
import dayjs from "dayjs";

import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import ApiError from "../utils/apiError.js";
import {
  calculateNights,
  checkRoomAvailability,
  isValidDateRange,
  markExpiredPendingBookings,
} from "../utils/booking.js";

function createBookingCode() {
  return `TR-${crypto.randomUUID().split("-")[0].toUpperCase()}`;
}

export async function createBooking(req, res) {
  const userId = req.user._id;
  const roomId = String(req.body.roomId);
  const units = Math.max(Number(req.body.units || 1), 1);
  const guests = Math.max(Number(req.body.guests || 1), 1);
  const checkIn = new Date(req.body.checkIn);
  const checkOut = new Date(req.body.checkOut);
  const notes = req.body.notes ? String(req.body.notes).trim() : "";
  const guestAddress = String(req.body.address || "").trim();
  const idProofUrl = req.body.idProofUrl ? String(req.body.idProofUrl).trim() : "";
  const paymentMode = String(req.body.paymentMode || "pay_at_hotel").trim();
  const sourceChannel = req.body.sourceChannel
    ? String(req.body.sourceChannel).trim()
    : "direct";
  const channelManagerReference = req.body.channelManagerReference
    ? String(req.body.channelManagerReference).trim()
    : "";

  if (!isValidDateRange(checkIn, checkOut)) {
    throw new ApiError(422, "Invalid check-in/check-out date range");
  }

  if (!["pay_at_hotel", "razorpay"].includes(paymentMode)) {
    throw new ApiError(422, "paymentMode must be pay_at_hotel or razorpay");
  }

  if (!guestAddress) {
    throw new ApiError(422, "Address is required for booking");
  }

  const checkInDay = dayjs(checkIn).startOf("day");
  if (checkInDay.isBefore(dayjs().startOf("day"))) {
    throw new ApiError(422, "Check-in cannot be in the past");
  }

  const room = await Room.findOne({ _id: roomId, isActive: true }).lean();
  if (!room) {
    throw new ApiError(404, "Room not found or inactive");
  }

  if (guests > room.maxGuestsPerUnit * units) {
    throw new ApiError(
      422,
      `This room supports up to ${room.maxGuestsPerUnit * units} guests for ${units} unit(s)`,
    );
  }

  await markExpiredPendingBookings();
  const availability = await checkRoomAvailability(room, checkIn, checkOut, units);
  if (!availability.isAvailable) {
    throw new ApiError(
      409,
      `Only ${availability.availableUnits} unit(s) are available for the selected dates`,
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const amount = nights * units * room.pricePerNight;
  const paymentDueAt =
    paymentMode === "razorpay" ? dayjs().add(15, "minute").toDate() : null;
  const bookingStatus = paymentMode === "razorpay" ? "pending_payment" : "pending";
  const paymentProvider = paymentMode === "razorpay" ? "razorpay" : "pay_at_hotel";

  const booking = await Booking.create({
    bookingCode: createBookingCode(),
    user: userId,
    room: room._id,
    checkIn,
    checkOut,
    nights,
    units,
    guests,
    amount,
    guestName: req.user.fullName,
    guestEmail: req.user.email,
    currency: process.env.CURRENCY || "INR",
    status: bookingStatus,
    paymentMode,
    paymentProvider,
    paymentDueAt,
    contactPhone: req.user.phone,
    guestAddress,
    idProofUrl,
    sourceChannel,
    channelManagerReference,
    notes,
  });

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      address: guestAddress,
    },
  });

  res.status(201).json({
    success: true,
    message:
      paymentMode === "razorpay"
        ? "Booking created. Complete payment to confirm your room."
        : "Booking placed successfully. Pay at hotel is selected and the team can confirm it from admin.",
    data: {
      booking,
    },
  });
}

export async function getMyBookings(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };
  if (req.query.status) {
    filter.status = String(req.query.status);
  }

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate("room", "name pricePerNight images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    success: true,
    data: {
      items: bookings,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getBookingById(req, res) {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("room", "name pricePerNight images amenities")
    .populate("user", "fullName email phone");

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (
    req.user.role === "user" &&
    String(booking.user._id) !== String(req.user._id)
  ) {
    throw new ApiError(403, "You do not have access to this booking");
  }

  res.json({
    success: true,
    data: { booking },
  });
}

export async function cancelBooking(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (String(booking.user) !== String(req.user._id)) {
    throw new ApiError(403, "You can cancel only your own bookings");
  }

  if (["cancelled", "completed"].includes(booking.status)) {
    throw new ApiError(409, `Booking is already ${booking.status}`);
  }

  booking.status = "cancelled";
  if (booking.paymentStatus === "paid") {
    booking.paymentStatus = "refunded";
  } else if (booking.paymentStatus === "pending") {
    booking.paymentStatus = "failed";
  }
  booking.paymentDueAt = null;
  await booking.save();

  res.json({
    success: true,
    message: "Booking cancelled",
    data: { booking },
  });
}
