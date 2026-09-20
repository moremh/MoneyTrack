export const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "it", label: "Italiano" },
];

export const DEFAULT_REGIONAL_SETTINGS = {
  language: "es",
  region: "AR",
  currency: "ARS",
  timezone: "America/Argentina/Buenos_Aires",
  timeFormat: "24h",
};

const REGION_CODES = ["AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"];

const FALLBACK_CURRENCIES = [
  "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "COP",
  "EUR", "GBP", "JPY", "MXN", "NZD", "PEN", "PYG", "USD", "UYU",
];

const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Pacific/Auckland",
];

const getSupportedValues = (key, fallback) => {
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      const values = Intl.supportedValuesOf(key);
      if (Array.isArray(values) && values.length > 0) return values;
    }
  } catch (error) {
    console.warn(`No se pudieron obtener valores Intl para ${key}:`, error);
  }
  return fallback;
};

export const normalizeLanguage = (value) => {
  const candidate = String(value || "").trim().toLowerCase();
  return LANGUAGE_OPTIONS.some((option) => option.value === candidate)
    ? candidate
    : DEFAULT_REGIONAL_SETTINGS.language;
};

export const normalizeRegion = (value) => {
  const candidate = String(value || "").trim().toUpperCase();
  return REGION_CODES.includes(candidate)
    ? candidate
    : DEFAULT_REGIONAL_SETTINGS.region;
};

export const normalizeCurrency = (value) => {
  const candidate = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(candidate)) return DEFAULT_REGIONAL_SETTINGS.currency;
  const supported = getSupportedValues("currency", FALLBACK_CURRENCIES);
  return supported.includes(candidate)
    ? candidate
    : DEFAULT_REGIONAL_SETTINGS.currency;
};

export const isValidTimeZone = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (value) => {
  const candidate = String(value || "").trim();
  return isValidTimeZone(candidate)
    ? candidate
    : DEFAULT_REGIONAL_SETTINGS.timezone;
};

export const normalizeTimeFormat = (value) => value === "12h" ? "12h" : "24h";

export const getLocale = (language, region) =>
  `${normalizeLanguage(language)}-${normalizeRegion(region)}`;

const getDisplayNames = (locale, type) => {
  try {
    if (typeof Intl?.DisplayNames === "function") {
      return new Intl.DisplayNames([locale], { type });
    }
  } catch (error) {
    console.warn(`No se pudieron generar nombres Intl para ${type}:`, error);
  }
  return null;
};

export const getCountryOptions = (language = "es") => {
  const normalizedLanguage = normalizeLanguage(language);
  const displayNames = getDisplayNames(normalizedLanguage, "region");
  return REGION_CODES
    .map((code) => ({ value: code, label: displayNames?.of(code) || code }))
    .sort((a, b) => a.label.localeCompare(b.label, normalizedLanguage));
};

export const getCurrencyOptions = (language = "es") => {
  const normalizedLanguage = normalizeLanguage(language);
  const displayNames = getDisplayNames(normalizedLanguage, "currency");
  return getSupportedValues("currency", FALLBACK_CURRENCIES)
    .map((code) => ({
      value: code,
      label: `${code} — ${displayNames?.of(code) || code}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, normalizedLanguage));
};

const getTimeZoneOffset = (timezone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
};

export const getTimeZoneOptions = () => {
  const values = getSupportedValues("timeZone", FALLBACK_TIME_ZONES);
  return Array.from(new Set(["UTC", ...values]))
    .filter(isValidTimeZone)
    .map((value) => {
      const offset = getTimeZoneOffset(value);
      const readable = value.replaceAll("_", " ");
      return { value, label: offset ? `${readable} (${offset})` : readable };
    });
};

export const detectRegionalPreferences = (currentSettings = {}) => {
  let language = currentSettings.language || DEFAULT_REGIONAL_SETTINGS.language;
  let region = currentSettings.region || DEFAULT_REGIONAL_SETTINGS.region;
  let timezone = currentSettings.timezone || DEFAULT_REGIONAL_SETTINGS.timezone;
  let timeFormat = currentSettings.timeFormat || DEFAULT_REGIONAL_SETTINGS.timeFormat;

  try {
    const locale = navigator?.language || Intl.DateTimeFormat().resolvedOptions().locale || "es-AR";
    const parsed = new Intl.Locale(locale);

    if (LANGUAGE_OPTIONS.some((option) => option.value === parsed.language)) {
      language = parsed.language;
    }

    if (parsed.region && REGION_CODES.includes(parsed.region)) {
      region = parsed.region;
    }

    const resolved = Intl.DateTimeFormat().resolvedOptions();
    if (resolved.timeZone && isValidTimeZone(resolved.timeZone)) {
      timezone = resolved.timeZone;
    }

    const hourOptions = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
    timeFormat = hourOptions.hour12 ? "12h" : "24h";
  } catch (error) {
    console.warn("No se pudo detectar la configuración regional:", error);
  }

  return {
    language: normalizeLanguage(language),
    region: normalizeRegion(region),
    currency: normalizeCurrency(currentSettings.currency || DEFAULT_REGIONAL_SETTINGS.currency),
    timezone: normalizeTimeZone(timezone),
    timeFormat: normalizeTimeFormat(timeFormat),
  };
};

export const formatRegionalCurrency = (value, settings = {}) => {
  const locale = getLocale(settings.language, settings.region);
  const currency = normalizeCurrency(settings.currency);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString(locale)}`;
  }
};

export const formatRegionalDateTime = (value, settings = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const locale = getLocale(settings.language, settings.region);
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: normalizeTimeZone(settings.timezone),
      hour12: normalizeTimeFormat(settings.timeFormat) === "12h",
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
};
