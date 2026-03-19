import express from "express";
import { body, param } from "express-validator";

import { ROLES } from "../config/roles.js";
import {
  cancelBooking,
  createBooking,
  getBookingById,
  getMyBookings,
} from "../controllers/bookingController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validate.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  [
    authorize(ROLES.USER),
    body("roomId").isMongoId().withMessage("roomId is required"),
    body("checkIn").isISO8601().withMessage("checkIn must be a valid ISO date"),
    body("checkOut").isISO8601().withMessage("checkOut must be a valid ISO date"),
    body("units").optional().isInt({ min: 1 }).withMessage("units must be >= 1"),
    body("guests").optional().isInt({ min: 1 }).withMessage("guests must be >= 1"),
    body("address")
      .trim()
      .isLength({ min: 5 })
      .withMessage("address is required"),
    body("idProofUrl").optional({ values: "falsy" }).trim().isLength({ min: 5 }),
    body("paymentMode")
      .optional()
      .isIn(["pay_at_hotel", "razorpay"])
      .withMessage("paymentMode must be pay_at_hotel or razorpay"),
    body("sourceChannel").optional({ values: "falsy" }).trim().isLength({ min: 2 }),
    body("channelManagerReference")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 2 }),
    body("notes").optional().isLength({ max: 500 }),
    validateRequest,
  ],
  createBooking,
);

router.get("/me", authorize(ROLES.USER), getMyBookings);

router.get(
  "/:bookingId",
  [param("bookingId").isMongoId().withMessage("Invalid booking ID"), validateRequest],
  getBookingById,
);

router.patch(
  "/:bookingId/cancel",
  [
    authorize(ROLES.USER),
    param("bookingId").isMongoId().withMessage("Invalid booking ID"),
    validateRequest,
  ],
  cancelBooking,
);

export default router;
