import bcrypt from "bcryptjs";
import crypto from "crypto";
import dayjs from "dayjs";

import PendingRegistration from "../models/PendingRegistration.js";
import User from "../models/User.js";
import {
  sendRegistrationOnboardingMessage,
  sendWhatsAppText,
} from "../services/whatsappService.js";
import ApiError from "../utils/apiError.js";
import { signAccessToken } from "../utils/jwt.js";
import { normalizeEmail, normalizePhone } from "../utils/normalizers.js";

function toPublicUser(userDoc) {
  const data = userDoc.toObject();
  delete data.passwordHash;
  return data;
}

export async function startRegistration(req, res) {
  const fullName = String(req.body.fullName).trim();
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  }).lean();

  if (existingUser) {
    throw new ApiError(409, "User with this email or phone already exists");
  }

  await PendingRegistration.deleteMany({
    $or: [{ email }, { phone }],
  });

  const registrationToken = crypto.randomUUID();
  const expiresAt = dayjs().add(20, "minute").toDate();

  await PendingRegistration.create({
    fullName,
    email,
    phone,
    registrationToken,
    expiresAt,
  });

  let whatsapp = { sent: false, skipped: true };
  try {
    whatsapp = await sendRegistrationOnboardingMessage({
      to: phone,
      fullName,
      registrationToken,
      expiresAt,
    });
  } catch (_error) {
    whatsapp = { sent: false, skipped: false };
  }

  res.status(201).json({
    success: true,
    message: "Registration started. Complete signup with the registration token.",
    data: {
      registrationToken,
      expiresAt,
      whatsapp,
    },
  });
}

export async function completeRegistration(req, res) {
  const registrationToken = String(req.body.registrationToken).trim();
  const password = String(req.body.password);

  const pendingRegistration = await PendingRegistration.findOne({
    registrationToken,
  });

  if (!pendingRegistration) {
    throw new ApiError(404, "Registration session not found");
  }

  if (dayjs().isAfter(dayjs(pendingRegistration.expiresAt))) {
    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    throw new ApiError(410, "Registration session expired. Start again.");
  }

  const existingUser = await User.findOne({
    $or: [{ email: pendingRegistration.email }, { phone: pendingRegistration.phone }],
  }).lean();

  if (existingUser) {
    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    throw new ApiError(409, "Account already exists. Please login.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName: pendingRegistration.fullName,
    email: pendingRegistration.email,
    phone: pendingRegistration.phone,
    passwordHash,
  });

  await PendingRegistration.deleteOne({ _id: pendingRegistration._id });

  const token = signAccessToken(user);

  try {
    await sendWhatsAppText({
      to: user.phone,
      text: `Hi ${user.fullName}, your account is ready. You can now book rooms at Thai Residency.`,
    });
  } catch (_error) {
    // Ignore WhatsApp failure at this stage; account creation already succeeded.
  }

  res.status(201).json({
    success: true,
    message: "Registration completed successfully",
    data: {
      token,
      user: toPublicUser(user),
    },
  });
}

export async function login(req, res) {
  const loginId = String(req.body.loginId).trim();
  const password = String(req.body.password);
  const email = normalizeEmail(loginId);
  const phone = normalizePhone(loginId);

  const user = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);
  res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: toPublicUser(user),
    },
  });
}

export async function getMe(req, res) {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

export async function updateMe(req, res) {
  const fullName = req.body.fullName ? String(req.body.fullName).trim() : undefined;
  const phone = req.body.phone ? normalizePhone(req.body.phone) : undefined;
  const address = req.body.address !== undefined ? String(req.body.address).trim() : undefined;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (phone && phone !== user.phone) {
    const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } }).lean();
    if (phoneExists) {
      throw new ApiError(409, "Phone already in use");
    }
    user.phone = phone;
  }

  if (fullName) {
    user.fullName = fullName;
  }

  if (address !== undefined) {
    user.address = address;
  }

  await user.save();
  res.json({
    success: true,
    message: "Profile updated",
    data: {
      user: toPublicUser(user),
    },
  });
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword);
  const newPassword = String(req.body.newPassword);

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({
    success: true,
    message: "Password changed successfully",
  });
}
