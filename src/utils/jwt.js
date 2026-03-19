import jwt from "jsonwebtoken";

import ApiError from "./apiError.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return secret;
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
}

export function decodeAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (_error) {
    throw new ApiError(401, "Invalid or expired access token");
  }
}
