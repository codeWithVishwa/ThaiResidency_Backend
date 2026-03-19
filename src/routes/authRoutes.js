import express from "express";
import { body } from "express-validator";

import {
  changePassword,
  completeRegistration,
  getMe,
  login,
  startRegistration,
  updateMe,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validate.js";

const router = express.Router();

router.post(
  "/register/start",
  [
    body("fullName").trim().isLength({ min: 2 }).withMessage("Full name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone")
      .isLength({ min: 8, max: 16 })
      .withMessage("Valid phone number is required"),
    validateRequest,
  ],
  startRegistration,
);

router.post(
  "/register/complete",
  [
    body("registrationToken")
      .trim()
      .isLength({ min: 10 })
      .withMessage("registrationToken is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password should be at least 8 characters"),
    validateRequest,
  ],
  completeRegistration,
);

router.post(
  "/login",
  [
    body("loginId").trim().notEmpty().withMessage("Email or phone is required"),
    body("password").notEmpty().withMessage("Password is required"),
    validateRequest,
  ],
  login,
);

router.get("/me", authenticate, getMe);

router.patch(
  "/me",
  [
    authenticate,
    body("fullName")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name should have at least 2 characters"),
    body("phone")
      .optional()
      .isLength({ min: 8, max: 16 })
      .withMessage("Valid phone number is required"),
    body("address")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 5 })
      .withMessage("Address should have at least 5 characters"),
    validateRequest,
  ],
  updateMe,
);

router.post(
  "/change-password",
  [
    authenticate,
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password should be at least 8 characters"),
    validateRequest,
  ],
  changePassword,
);

export default router;
