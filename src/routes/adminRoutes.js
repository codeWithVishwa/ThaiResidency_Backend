import express from "express";
import { body, param } from "express-validator";

import { ADMIN_PANEL_ROLES, ROLES } from "../config/roles.js";
import {
  createBlog,
  createStaffUser,
  deleteBlog,
  getDashboardStats,
  listBlogs,
  listAllBookings,
  listUsers,
  updateBlog,
  updateBookingStatus,
  updateUserRole,
  updateUserStatus,
} from "../controllers/adminController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validate.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ADMIN_PANEL_ROLES));

router.get("/dashboard", getDashboardStats);

router.post(
  "/staff",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
    body("fullName").trim().isLength({ min: 2 }),
    body("email").isEmail(),
    body("phone").isLength({ min: 8, max: 16 }),
    body("password").isLength({ min: 8 }),
    body("role").isIn([ROLES.ADMIN, ROLES.MODERATOR]),
    validateRequest,
  ],
  createStaffUser,
);

router.get("/users", listUsers);

router.patch(
  "/users/:userId/role",
  [
    authorize(ROLES.SUPER_ADMIN),
    param("userId").isMongoId(),
    body("role").isIn([ROLES.ADMIN, ROLES.MODERATOR, ROLES.USER]),
    validateRequest,
  ],
  updateUserRole,
);

router.patch(
  "/users/:userId/status",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
    param("userId").isMongoId(),
    body("isActive").isBoolean(),
    validateRequest,
  ],
  updateUserStatus,
);

router.get("/bookings", listAllBookings);

router.patch(
  "/bookings/:bookingId/status",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR),
    param("bookingId").isMongoId(),
    body("status").isIn([
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "payment_failed",
    ]),
    validateRequest,
  ],
  updateBookingStatus,
);

router.get("/blogs", listBlogs);

router.post(
  "/blogs",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR),
    body("title").trim().isLength({ min: 3 }),
    body("slug").optional().trim().isLength({ min: 3 }),
    body("excerpt").optional({ values: "falsy" }).trim().isLength({ min: 10 }),
    body("content").trim().isLength({ min: 20 }),
    body("coverImage").optional({ values: "falsy" }).trim().isLength({ min: 5 }),
    body("status").optional().isIn(["draft", "published"]),
    validateRequest,
  ],
  createBlog,
);

router.patch(
  "/blogs/:blogId",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR),
    param("blogId").isMongoId(),
    body("title").optional({ values: "falsy" }).trim().isLength({ min: 3 }),
    body("slug").optional({ values: "falsy" }).trim().isLength({ min: 3 }),
    body("excerpt").optional({ values: "falsy" }).trim().isLength({ min: 10 }),
    body("content").optional({ values: "falsy" }).trim().isLength({ min: 20 }),
    body("coverImage").optional({ values: "falsy" }).trim().isLength({ min: 5 }),
    body("status").optional().isIn(["draft", "published"]),
    validateRequest,
  ],
  updateBlog,
);

router.delete(
  "/blogs/:blogId",
  [
    authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
    param("blogId").isMongoId(),
    validateRequest,
  ],
  deleteBlog,
);

export default router;
