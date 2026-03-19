import bcrypt from "bcryptjs";
import dayjs from "dayjs";

import { ROLES } from "../config/roles.js";
import Blog from "../models/Blog.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import ApiError from "../utils/apiError.js";
import { normalizeEmail, normalizePhone } from "../utils/normalizers.js";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canManageTargetUser(actorRole, targetRole) {
  if (actorRole === ROLES.SUPER_ADMIN) return true;
  if (actorRole === ROLES.ADMIN) {
    return ![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(targetRole);
  }
  return false;
}

function safeUser(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete user.passwordHash;
  return user;
}

export async function createStaffUser(req, res) {
  const role = String(req.body.role || "").trim();

  if (![ROLES.ADMIN, ROLES.MODERATOR].includes(role)) {
    throw new ApiError(422, "Role must be admin or moderator");
  }

  if (req.user.role === ROLES.ADMIN && role !== ROLES.MODERATOR) {
    throw new ApiError(403, "Admin can only create moderator accounts");
  }

  const fullName = String(req.body.fullName).trim();
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);
  const password = String(req.body.password);

  const existing = await User.findOne({
    $or: [{ email }, { phone }],
  }).lean();
  if (existing) {
    throw new ApiError(409, "User with this email or phone already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email,
    phone,
    passwordHash,
    role,
  });

  res.status(201).json({
    success: true,
    message: `${role} account created`,
    data: { user: safeUser(user) },
  });
}

export async function getDashboardStats(_req, res) {
  const [
    totalUsers,
    totalRooms,
    totalBookings,
    pendingBookings,
    pendingPaymentBookings,
    confirmedBookings,
    totalBlogs,
    revenueRows,
    roleStats,
  ] = await Promise.all([
    User.countDocuments(),
    Room.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ status: "pending" }),
    Booking.countDocuments({ status: "pending_payment" }),
    Booking.countDocuments({ status: "confirmed" }),
    Blog.countDocuments(),
    Booking.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);

  const totalRevenue = revenueRows[0]?.totalRevenue || 0;

  res.json({
    success: true,
    data: {
      totals: {
        users: totalUsers,
        rooms: totalRooms,
        bookings: totalBookings,
        pendingBookings,
        pendingPaymentBookings,
        confirmedBookings,
        blogs: totalBlogs,
        revenue: totalRevenue,
      },
      usersByRole: roleStats,
      generatedAt: dayjs().toISOString(),
    },
  });
}

export async function listUsers(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.role) {
    filter.role = String(req.query.role);
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      items: users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function updateUserRole(req, res) {
  const targetUser = await User.findById(req.params.userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const nextRole = String(req.body.role);
  if (![ROLES.ADMIN, ROLES.MODERATOR, ROLES.USER].includes(nextRole)) {
    throw new ApiError(422, "Invalid target role");
  }

  targetUser.role = nextRole;
  await targetUser.save();

  res.json({
    success: true,
    message: "User role updated",
    data: { user: safeUser(targetUser) },
  });
}

export async function updateUserStatus(req, res) {
  const targetUser = await User.findById(req.params.userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  if (String(targetUser._id) === String(req.user._id)) {
    throw new ApiError(422, "You cannot update your own active status");
  }

  if (!canManageTargetUser(req.user.role, targetUser.role)) {
    throw new ApiError(403, "You cannot update this user's status");
  }

  targetUser.isActive = Boolean(req.body.isActive);
  await targetUser.save();

  res.json({
    success: true,
    message: "User status updated",
    data: { user: safeUser(targetUser) },
  });
}

export async function listAllBookings(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.status = String(req.query.status);
  }
  if (req.query.paymentStatus) {
    filter.paymentStatus = String(req.query.paymentStatus);
  }
  if (req.query.fromDate || req.query.toDate) {
    filter.createdAt = {};
    if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.createdAt.$lte = new Date(req.query.toDate);
  }

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate("user", "fullName email phone role")
      .populate("room", "name pricePerNight")
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

export async function updateBookingStatus(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const nextStatus = String(req.body.status);
  const allowedStatuses = [
    "pending",
    "confirmed",
    "cancelled",
    "completed",
    "payment_failed",
  ];
  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(422, "Invalid booking status");
  }

  booking.status = nextStatus;
  if (
    nextStatus === "confirmed" &&
    booking.paymentMode === "razorpay" &&
    booking.paymentStatus === "pending"
  ) {
    booking.paymentStatus = "paid";
  }
  if (nextStatus === "cancelled" && booking.paymentStatus === "paid") {
    booking.paymentStatus = "refunded";
  }
  if (nextStatus === "payment_failed") {
    booking.paymentStatus = "failed";
  }
  if (nextStatus !== "pending_payment") {
    booking.paymentDueAt = null;
  }

  await booking.save();

  res.json({
    success: true,
    message: "Booking status updated",
    data: { booking },
  });
}

export async function listBlogs(req, res) {
  const blogs = await Blog.find()
    .populate("author", "fullName email")
    .sort({ updatedAt: -1 });

  res.json({
    success: true,
    data: {
      items: blogs,
    },
  });
}

export async function createBlog(req, res) {
  const title = String(req.body.title).trim();
  const slug = slugify(req.body.slug || title);

  if (!slug) {
    throw new ApiError(422, "A valid blog slug could not be generated");
  }

  const existing = await Blog.findOne({ slug }).lean();
  if (existing) {
    throw new ApiError(409, "A blog with this slug already exists");
  }

  const status = String(req.body.status || "draft");
  const blog = await Blog.create({
    title,
    slug,
    excerpt: req.body.excerpt ? String(req.body.excerpt).trim() : "",
    content: String(req.body.content || "").trim(),
    coverImage: req.body.coverImage ? String(req.body.coverImage).trim() : "",
    status,
    publishedAt: status === "published" ? new Date() : null,
    author: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: "Blog saved",
    data: { blog },
  });
}

export async function updateBlog(req, res) {
  const blog = await Blog.findById(req.params.blogId);
  if (!blog) {
    throw new ApiError(404, "Blog not found");
  }

  const nextTitle = req.body.title !== undefined ? String(req.body.title).trim() : blog.title;
  const nextSlug = req.body.slug !== undefined ? slugify(req.body.slug) : blog.slug;

  if (nextSlug !== blog.slug) {
    const duplicate = await Blog.findOne({
      slug: nextSlug,
      _id: { $ne: blog._id },
    }).lean();
    if (duplicate) {
      throw new ApiError(409, "A blog with this slug already exists");
    }
    blog.slug = nextSlug;
  }

  blog.title = nextTitle;
  if (req.body.excerpt !== undefined) {
    blog.excerpt = String(req.body.excerpt).trim();
  }
  if (req.body.content !== undefined) {
    blog.content = String(req.body.content).trim();
  }
  if (req.body.coverImage !== undefined) {
    blog.coverImage = String(req.body.coverImage).trim();
  }
  if (req.body.status !== undefined) {
    blog.status = String(req.body.status);
    blog.publishedAt =
      blog.status === "published" ? blog.publishedAt || new Date() : null;
  }

  await blog.save();

  res.json({
    success: true,
    message: "Blog updated",
    data: { blog },
  });
}

export async function deleteBlog(req, res) {
  const blog = await Blog.findById(req.params.blogId);
  if (!blog) {
    throw new ApiError(404, "Blog not found");
  }

  await Blog.deleteOne({ _id: blog._id });

  res.json({
    success: true,
    message: "Blog deleted",
  });
}
