import Room from "../models/Room.js";
import ApiError from "../utils/apiError.js";
import { checkRoomAvailability, isValidDateRange } from "../utils/booking.js";

export async function listRooms(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const skip = (page - 1) * limit;

  const canSeeInactive = req.user && req.query.includeInactive === "true";

  const filter = {};
  if (!canSeeInactive) {
    filter.isActive = true;
  }

  const minPrice = Number(req.query.minPrice || 0);
  const maxPrice = Number(req.query.maxPrice || 0);

  if (minPrice > 0 || maxPrice > 0) {
    filter.pricePerNight = {};
    if (minPrice > 0) filter.pricePerNight.$gte = minPrice;
    if (maxPrice > 0) filter.pricePerNight.$lte = maxPrice;
  }

  const [total, rooms] = await Promise.all([
    Room.countDocuments(filter),
    Room.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const checkIn = req.query.checkIn ? new Date(req.query.checkIn) : null;
  const checkOut = req.query.checkOut ? new Date(req.query.checkOut) : null;
  const requestedUnits = Math.max(Number(req.query.units || 1), 1);
  const showUnavailable = req.query.showUnavailable === "true";

  let items = rooms;

  if (checkIn && checkOut) {
    if (!isValidDateRange(checkIn, checkOut)) {
      throw new ApiError(422, "Invalid check-in/check-out date range");
    }

    const roomsWithAvailability = await Promise.all(
      rooms.map(async (room) => {
        const availability = await checkRoomAvailability(
          room,
          checkIn,
          checkOut,
          requestedUnits,
        );
        return {
          ...room,
          availability,
        };
      }),
    );

    items = showUnavailable
      ? roomsWithAvailability
      : roomsWithAvailability.filter((room) => room.availability.isAvailable);
  }

  res.json({
    success: true,
    data: {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getRoomById(req, res) {
  const room = await Room.findById(req.params.roomId).lean();
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  const checkIn = req.query.checkIn ? new Date(req.query.checkIn) : null;
  const checkOut = req.query.checkOut ? new Date(req.query.checkOut) : null;
  const requestedUnits = Math.max(Number(req.query.units || 1), 1);

  let roomPayload = room;
  if (checkIn && checkOut) {
    if (!isValidDateRange(checkIn, checkOut)) {
      throw new ApiError(422, "Invalid check-in/check-out date range");
    }

    const availability = await checkRoomAvailability(
      room,
      checkIn,
      checkOut,
      requestedUnits,
    );

    roomPayload = {
      ...room,
      availability,
    };
  }

  res.json({
    success: true,
    data: { room: roomPayload },
  });
}

export async function createRoom(req, res) {
  const payload = {
    name: String(req.body.name).trim(),
    description: req.body.description ? String(req.body.description).trim() : "",
    channelManagerCode: req.body.channelManagerCode
      ? String(req.body.channelManagerCode).trim()
      : "",
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
    images: Array.isArray(req.body.images) ? req.body.images : [],
    totalUnits: Number(req.body.totalUnits),
    pricePerNight: Number(req.body.pricePerNight),
    maxGuestsPerUnit: Number(req.body.maxGuestsPerUnit),
    isActive: req.body.isActive !== false,
    createdBy: req.user._id,
  };

  const room = await Room.create(payload);
  res.status(201).json({
    success: true,
    message: "Room created",
    data: { room },
  });
}

export async function updateRoom(req, res) {
  const room = await Room.findById(req.params.roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  const editableFields = [
    "name",
    "description",
    "channelManagerCode",
    "amenities",
    "images",
    "totalUnits",
    "pricePerNight",
    "maxGuestsPerUnit",
    "isActive",
  ];

  for (const field of editableFields) {
    if (req.body[field] !== undefined) {
      room[field] = req.body[field];
    }
  }

  await room.save();
  res.json({
    success: true,
    message: "Room updated",
    data: { room },
  });
}

export async function deleteRoom(req, res) {
  const room = await Room.findById(req.params.roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  room.isActive = false;
  await room.save();

  res.json({
    success: true,
    message: "Room deactivated",
  });
}
