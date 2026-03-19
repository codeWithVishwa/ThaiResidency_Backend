import express from "express";
import { body } from "express-validator";

import { ROLES } from "../config/roles.js";
import {
  createBookingOrder,
  getPaymentConfig,
  verifyBookingPayment,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validate.js";

const router = express.Router();

router.get("/config", getPaymentConfig);

router.post(
  "/create-order",
  [
    authenticate,
    authorize(ROLES.USER),
    body("bookingId").isMongoId().withMessage("bookingId is required"),
    validateRequest,
  ],
  createBookingOrder,
);

router.post(
  "/verify",
  [
    authenticate,
    authorize(ROLES.USER),
    body("bookingId").isMongoId().withMessage("bookingId is required"),
    body("razorpayOrderId")
      .trim()
      .notEmpty()
      .withMessage("razorpayOrderId is required"),
    body("razorpayPaymentId")
      .trim()
      .notEmpty()
      .withMessage("razorpayPaymentId is required"),
    body("razorpaySignature")
      .trim()
      .notEmpty()
      .withMessage("razorpaySignature is required"),
    validateRequest,
  ],
  verifyBookingPayment,
);

export default router;
