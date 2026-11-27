const HARD_BLOCKED_COUNTRIES = new Set(["VN"]);

function parseCountryAllowlist(value) {
  return new Set(String(value || "").split(",").map((item) => item.trim().toUpperCase()).filter((item) => /^[A-Z]{2}$/.test(item)));
}

/** Uses Cloudflare's edge-resolved request.cf.country only; client headers are never trusted. */
export function evaluateAdultGeoPolicy(request, env = {}) {
  const country = String(request?.cf?.country || "").trim().toUpperCase();
  const allowedCountries = parseCountryAllowlist(env.ADULT_ALLOWED_COUNTRIES);
  const countryKnown = /^[A-Z]{2}$/.test(country);
  const countryAllowed = countryKnown && !HARD_BLOCKED_COUNTRIES.has(country) && allowedCountries.has(country);
  const enabled = String(env.ADULT_CONTENT_ENABLED || "").toLowerCase() === "true";
  const rightsConfirmed = String(env.ADULT_PROVIDER_RIGHTS_CONFIRMED || "").toLowerCase() === "true";
  return {
    country: countryKnown ? country : null,
    countryAllowed,
    enabled: countryAllowed && enabled && rightsConfirmed,
    allowed: countryAllowed,
    reason: !countryKnown ? "country_unknown" : HARD_BLOCKED_COUNTRIES.has(country) ? "country_blocked" : !allowedCountries.has(country) ? "country_not_allowlisted" : !enabled ? "feature_disabled" : !rightsConfirmed ? "provider_rights_unconfirmed" : "geo_allowed"
  };
}
