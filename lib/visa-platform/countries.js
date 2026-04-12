import countries from "i18n-iso-countries"
import en from "i18n-iso-countries/langs/en.json"

countries.registerLocale(en)

const COUNTRY_NAMES = countries.getNames("en", { select: "official" })

const COUNTRY_ALIASES = {
  UK: "GB",
  GBR: "GB",
  BRITAIN: "GB",
  "GREAT BRITAIN": "GB",
  ENGLAND: "GB",
  SCOTLAND: "GB",
  WALES: "GB",
  "NORTHERN IRELAND": "GB",
  US: "US",
  USA: "US",
  "UNITED STATES OF AMERICA": "US",
  UAE: "AE",
}

for (const [code, label] of Object.entries(COUNTRY_NAMES)) {
  COUNTRY_ALIASES[code] = code
  COUNTRY_ALIASES[label.toUpperCase()] = code
}

export const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES)
  .map(([code, label]) => ({ code, label }))
  .sort((left, right) => left.label.localeCompare(right.label))

/**
 * @param {string | null | undefined} input
 */
function cleanInput(input) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
}

/**
 * @param {string | null | undefined} input
 * @returns {string | null}
 */
export function normalizeCountryCode(input) {
  const cleaned = cleanInput(input)
  if (!cleaned || cleaned === "ALL" || cleaned === "*") {
    return null
  }

  if (COUNTRY_ALIASES[cleaned]) {
    return COUNTRY_ALIASES[cleaned]
  }

  if (/^[A-Z]{2}$/.test(cleaned) && countries.isValid(cleaned)) {
    return cleaned
  }

  return null
}

/**
 * @param {string[] | null | undefined} values
 * @returns {string[]}
 */
export function normalizeCountryCodes(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  for (const value of values) {
    const code = normalizeCountryCode(value)
    if (code) seen.add(code)
  }
  return [...seen]
}

/**
 * @param {string | null | undefined} input
 * @returns {string | undefined}
 */
export function normalizeCountryFilter(input) {
  const cleaned = cleanInput(input)
  if (!cleaned || cleaned === "ALL" || cleaned === "*") {
    return undefined
  }

  return normalizeCountryCode(cleaned) ?? undefined
}

/**
 * @param {string | null | undefined} code
 * @returns {string}
 */
export function getCountryLabel(code) {
  if (!code) return "Unknown"
  return COUNTRY_NAMES[code] ?? code
}

/**
 * @param {string | null | undefined} location
 * @returns {string | null}
 */
export function detectCountryCodeFromLocation(location) {
  if (!location) return null
  const lower = location.toLowerCase()

  if (
    lower.includes("united kingdom") ||
    lower.includes(", uk") ||
    lower.includes("(uk)") ||
    lower === "uk" ||
    lower.includes("england") ||
    lower.includes("scotland") ||
    lower.includes("wales") ||
    lower.includes("northern ireland") ||
    lower.includes("london") ||
    lower.includes("manchester") ||
    lower.includes("birmingham") ||
    lower.includes("edinburgh") ||
    lower.includes("glasgow") ||
    lower.includes("bristol") ||
    lower.includes("leeds") ||
    lower.includes("sheffield") ||
    lower.includes("cardiff") ||
    lower.includes("liverpool") ||
    lower.includes("newcastle") ||
    lower.includes("nottingham") ||
    lower.includes("leicester") ||
    lower.includes("coventry") ||
    lower.includes("brighton") ||
    lower.includes("cambridge") ||
    lower.includes("oxford")
  ) return "GB"

  if (
    lower.includes("united states") ||
    lower.includes(" usa") ||
    lower.includes(", us") ||
    lower.includes("new york") ||
    lower.includes("san francisco") ||
    lower.includes("los angeles") ||
    lower.includes("seattle") ||
    lower.includes("chicago") ||
    lower.includes("boston") ||
    lower.includes("austin") ||
    lower.includes("denver") ||
    lower.includes("atlanta") ||
    lower.includes("miami") ||
    lower.includes("dallas") ||
    lower.includes("houston") ||
    lower.includes("washington, d")
  ) return "US"

  if (
    lower.includes("india") ||
    lower.includes("bangalore") ||
    lower.includes("bengaluru") ||
    lower.includes("mumbai") ||
    lower.includes("delhi") ||
    lower.includes("hyderabad") ||
    lower.includes("chennai") ||
    lower.includes("pune") ||
    lower.includes("kolkata")
  ) return "IN"

  if (lower.includes("ireland") || lower.includes("dublin") || lower.includes("cork")) return "IE"
  if (
    lower.includes("germany") ||
    lower.includes("berlin") ||
    lower.includes("munich") ||
    lower.includes("hamburg") ||
    lower.includes("frankfurt")
  ) return "DE"
  if (lower.includes("netherlands") || lower.includes("amsterdam") || lower.includes("rotterdam")) return "NL"
  if (lower.includes("france") || lower.includes("paris") || lower.includes("lyon")) return "FR"
  if (lower.includes("spain") || lower.includes("madrid") || lower.includes("barcelona")) return "ES"
  if (
    lower.includes("canada") ||
    lower.includes("toronto") ||
    lower.includes("vancouver") ||
    lower.includes("montreal")
  ) return "CA"
  if (
    lower.includes("australia") ||
    lower.includes("sydney") ||
    lower.includes("melbourne") ||
    lower.includes("brisbane") ||
    lower.includes("perth")
  ) return "AU"
  if (lower.includes("singapore")) return "SG"
  if (lower.includes("dubai") || lower.includes("abu dhabi") || lower.includes("uae")) return "AE"
  if (lower.includes("poland") || lower.includes("warsaw") || lower.includes("krakow")) return "PL"
  if (lower.includes("estonia") || lower.includes("tallinn")) return "EE"
  if (lower.includes("ukraine") || lower.includes("kyiv") || lower.includes("kiev")) return "UA"
  if (lower.includes("romania") || lower.includes("bucharest")) return "RO"

  return null
}

/**
 * @param {{ countryCode?: string | null, location?: string | null }} input
 * @returns {{ countryCode: string | null, countryConfidence: string }}
 */
export function resolveCountryMetadata(input) {
  const explicit = normalizeCountryCode(input.countryCode)
  if (explicit) {
    return { countryCode: explicit, countryConfidence: "exact" }
  }

  const inferred = detectCountryCodeFromLocation(input.location)
  if (inferred) {
    return { countryCode: inferred, countryConfidence: "location_inferred" }
  }

  return { countryCode: null, countryConfidence: "unknown" }
}
