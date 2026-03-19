import express from "express";
import { body, param } from "express-validator";

import { ROLES } from "../config/roles.js";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  listRooms,
  updateRoom,
} from "../controllers/roomController.js";
import { authenticate, authenticateOptional, authorize } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validate.js";

const router = express.Router();

router.get("/", authenticateOptional, listRooms);

router.get(
  "/:roomId",
  [param("roomId").isMongoId().withMessage("Invalid room ID"), validateRequest],
  getRoomById,
);

router.post(
  "/",
  [
    authenticate,
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR),
    body("name").trim().isLength({ min: 2 }).withMessage("Room name is required"),
    body("channelManagerCode").optional({ values: "falsy" }).trim().isLength({ min: 2 }),
    body("totalUnits").isInt({ min: 1 }).withMessage("totalUnits must be at least 1"),
    body("pricePerNight")
      .isFloat({ min: 0 })
      .withMessage("pricePerNight must be a positive number"),
    body("maxGuestsPerUnit")
      .isInt({ min: 1 })
      .withMessage("maxGuestsPerUnit must be at least 1"),
    body("amenities").optional().isArray().withMessage("amenities should be an array"),
    body("images").optional().isArray().withMessage("images should be an array"),
    validateRequest,
  ],
  createRoom,
);

router.patch(
  "/:roomId",
  [
    authenticate,
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR),
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    body("name").optional().trim().isLength({ min: 2 }),
    body("channelManagerCode").optional({ values: "falsy" }).trim().isLength({ min: 2 }),
    body("totalUnits").optional().isInt({ min: 1 }),
    body("pricePerNight").optional().isFloat({ min: 0 }),
    body("maxGuestsPerUnit").optional().isInt({ min: 1 }),
    body("amenities").optional().isArray(),
    body("images").optional().isArray(),
    body("isActive").optional().isBoolean(),
    validateRequest,
  ],
  updateRoom,
);

router.delete(
  "/:roomId",
  [
    authenticate,
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    validateRequest,
  ],
  deleteRoom,
);

export default router;
