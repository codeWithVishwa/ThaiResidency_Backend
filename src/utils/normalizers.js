export function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const hasPlusPrefix = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 8) return raw;

  return hasPlusPrefix ? `+${digits}` : `+${digits}`;
}
