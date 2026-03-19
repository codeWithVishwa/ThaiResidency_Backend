import bcrypt from "bcryptjs";

import { ROLES } from "../config/roles.js";
import User from "../models/User.js";
import { normalizeEmail, normalizePhone } from "../utils/normalizers.js";

export async function ensureSuperAdmin() {
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_NAME || "Super Admin";
  const phone = normalizePhone(process.env.SUPER_ADMIN_PHONE || "");

  if (!email || !password || !phone) {
    console.log(
      "SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD or SUPER_ADMIN_PHONE missing. Skipping super admin seed.",
    );
    return;
  }

  const existingSuperAdmin = await User.findOne({ email });
  if (existingSuperAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    fullName,
    email,
    phone,
    passwordHash,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
  });

  console.log("Seeded default super admin");
}
