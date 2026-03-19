import dayjs from "dayjs";
import mongoose from "mongoose";

import Booking from "../models/Booking.js";

export function calculateNights(checkIn, checkOut) {
  return dayjs(checkOut).startOf("day").diff(dayjs(checkIn).startOf("day"), "day");
}

export function isValidDateRange(checkIn, checkOut) {
  const start = dayjs(checkIn);
  const end = dayjs(checkOut);
  return start.isValid() && end.isValid() && end.startOf("day").isAfter(start.startOf("day"));
}

export async function markExpiredPendingBookings() {
  await Booking.updateMany(
    {
      status: "pending_payment",
      paymentDueAt: { $lt: new Date() },
    },
    {
      $set: {
        status: "payment_failed",
        paymentStatus: "failed",
      },
    },
  );
}

export async function getBookedUnits(roomId, checkIn, checkOut, excludeBookingId = null) {
  const overlapCondition = {
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  const statusCondition = {
    $or: [
      { status: { $in: ["confirmed", "completed"] } },
      {
        status: "pending_payment",
        paymentDueAt: { $gt: new Date() },
      },
    ],
  };

  const match = {
    room: new mongoose.Types.ObjectId(roomId),
    ...overlapCondition,
    ...statusCondition,
  };

  if (excludeBookingId) {
    match._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const result = await Booking.aggregate([
    { $match: match },
    { $group: { _id: null, bookedUnits: { $sum: "$units" } } },
  ]);

  return result[0]?.bookedUnits || 0;
}

export async function checkRoomAvailability(room, checkIn, checkOut, requestedUnits) {
  const bookedUnits = await getBookedUnits(room._id, checkIn, checkOut);
  const availableUnits = Math.max(0, room.totalUnits - bookedUnits);

  return {
    availableUnits,
    bookedUnits,
    isAvailable: availableUnits >= requestedUnits,
  };
}
