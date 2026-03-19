export const ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
  USER: "user",
});

export const ALL_ROLES = Object.values(ROLES);

export const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR];
export const ADMIN_PANEL_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR];
