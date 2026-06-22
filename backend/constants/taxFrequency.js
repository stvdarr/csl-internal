
// Constants for tax frequency and period normalization (PRD §4.1, §6.3)
export const TAX_FREQUENCY = {
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
};

// Tax types that are annual (PRD §FR-08)
const ANNUAL_TAX_TYPES = new Set([
  "1770 OP",
  "1771 BADAN",
  "1770 S",
  "1770 SS",
]);


/**
 * Resolve frequency for a given tax type
 * @param {string} taxType - The tax type to resolve
 * @returns {string} TAX_FREQUENCY.MONTHLY or TAX_FREQUENCY.ANNUAL
 */
export const resolveFrequency = (taxType) => {
  const normalizedType = taxType?.toUpperCase().trim() || "";
  
  if (ANNUAL_TAX_TYPES.has(normalizedType)) {
    return TAX_FREQUENCY.ANNUAL;
  }
  
  return TAX_FREQUENCY.MONTHLY;
};

/**
 * Normalize period label for consistency
 * @param {string} period - Raw period string from import or user input
 * @param {string} frequency - TAX_FREQUENCY.MONTHLY or TAX_FREQUENCY.ANNUAL
 * @returns {string} Normalized period label
 */
export const normalizePeriodLabel = (period, frequency) => {
  const rawPeriod = String(period || "").trim();
  
  if (frequency === TAX_FREQUENCY.ANNUAL) {
    // Extract year number from the string (handles "2026", "TAHUN 2026", "TAHUNAN 2026", etc.)
    const yearMatch = rawPeriod.match(/(\d{4})/);
    if (yearMatch) {
      return `TAHUNAN ${yearMatch[1]}`;
    }
    // If no year found, just use the raw string or fallback
    return rawPeriod || "TAHUNAN";
  }
  
  // For monthly, just trim and return as is for now
  return rawPeriod;
};
