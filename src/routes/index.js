import express from "express";

import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import blogRoutes from "./blogRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import roomRoutes from "./roomRoutes.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "API healthy" });
});

router.use("/auth", authRoutes);
router.use("/blogs", blogRoutes);
router.use("/rooms", roomRoutes);
router.use("/bookings", bookingRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);

export default router;
