import User from "../models/User.js";
import ApiError from "../utils/apiError.js";
import { decodeAccessToken } from "../utils/jwt.js";

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }

  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}

export async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  const payload = decodeAccessToken(token);

  const user = await User.findById(payload.sub).select(
    "_id fullName email phone address role isActive",
  );
  if (!user || !user.isActive) {
    return next(new ApiError(401, "User is inactive or does not exist"));
  }

  req.user = user;
  return next();
}

export async function authenticateOptional(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = decodeAccessToken(token);
    const user = await User.findById(payload.sub).select(
      "_id fullName email phone address role isActive",
    );

    if (user && user.isActive) {
      req.user = user;
    }
  } catch (_error) {
    req.user = null;
  }

  return next();
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission for this action"));
    }

    return next();
  };
}
