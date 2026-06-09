export const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
