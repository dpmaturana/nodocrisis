/**
 * Simple location-to-coordinates lookup for map fallback centering.
 *
 * When an event has no sectors with coordinates, the map uses this
 * utility to derive a reasonable center from the event's `location`
 * string instead of always defaulting to Chile.
 */

/** Well-known locations mapped to [latitude, longitude]. */
const KNOWN_LOCATIONS: Record<string, [number, number]> = {
  // Countries
  chile: [-33.45, -70.67],
  "united kingdom": [54.0, -2.0],
  uk: [54.0, -2.0],
  "united states": [39.83, -98.58],
  usa: [39.83, -98.58],
  us: [39.83, -98.58],
  mexico: [23.63, -102.55],
  méxico: [23.63, -102.55],
  argentina: [-34.6, -58.38],
  brazil: [-14.24, -51.93],
  brasil: [-14.24, -51.93],
  colombia: [4.57, -74.3],
  peru: [-9.19, -75.0],
  perú: [-9.19, -75.0],
  ecuador: [-1.83, -78.18],
  bolivia: [-16.29, -63.59],
  spain: [40.46, -3.75],
  españa: [40.46, -3.75],
  france: [46.6, 1.89],
  francia: [46.6, 1.89],
  germany: [51.17, 10.45],
  alemania: [51.17, 10.45],
  italy: [41.87, 12.57],
  italia: [41.87, 12.57],
  portugal: [39.4, -8.22],
  japan: [36.2, 138.25],
  japón: [36.2, 138.25],
  australia: [-25.27, 133.78],
  india: [20.59, 78.96],
  china: [35.86, 104.2],
  canada: [56.13, -106.35],
  canadá: [56.13, -106.35],
  haiti: [18.97, -72.29],
  haití: [18.97, -72.29],
  turkey: [38.96, 35.24],
  türkiye: [38.96, 35.24],
  turquía: [38.96, 35.24],
  nepal: [28.39, 84.12],
  indonesia: [-0.79, 113.92],
  philippines: [12.88, 121.77],
  filipinas: [12.88, 121.77],
  "new zealand": [-40.9, 174.89],
  "nueva zelanda": [-40.9, 174.89],
  venezuela: [6.42, -66.59],
  paraguay: [-23.44, -58.44],
  uruguay: [-32.52, -55.77],

  // Chilean regions
  "arica y parinacota": [-18.47, -70.31],
  tarapacá: [-20.21, -69.33],
  antofagasta: [-23.65, -70.4],
  atacama: [-27.37, -70.33],
  coquimbo: [-29.95, -71.34],
  valparaíso: [-33.05, -71.61],
  valparaiso: [-33.05, -71.61],
  metropolitana: [-33.45, -70.67],
  "región metropolitana": [-33.45, -70.67],
  "region metropolitana": [-33.45, -70.67],
  santiago: [-33.45, -70.67],
  "o'higgins": [-34.17, -70.74],
  ohiggins: [-34.17, -70.74],
  maule: [-35.43, -71.66],
  ñuble: [-36.62, -71.82],
  biobío: [-37.47, -72.36],
  biobio: [-37.47, -72.36],
  "la araucanía": [-38.95, -72.33],
  "la araucania": [-38.95, -72.33],
  "los ríos": [-39.81, -72.68],
  "los rios": [-39.81, -72.68],
  valdivia: [-39.81, -73.25],
  "los lagos": [-41.47, -72.94],
  aysén: [-45.57, -72.07],
  aysen: [-45.57, -72.07],
  magallanes: [-53.16, -70.92],

  // UK regions / cities
  england: [52.36, -1.17],
  scotland: [56.49, -4.2],
  wales: [52.13, -3.78],
  "northern ireland": [54.79, -6.49],
  london: [51.51, -0.13],
  manchester: [53.48, -2.24],
  birmingham: [52.49, -1.9],
  liverpool: [53.41, -2.98],
  edinburgh: [55.95, -3.19],
  glasgow: [55.86, -4.25],
};

/**
 * Attempt to resolve a free-text location string to [lat, lng].
 *
 * The lookup is case-insensitive and tries progressively shorter
 * substrings (splitting on commas) so that "Valdivia, Los Ríos"
 * matches "valdivia" if the full string is not in the table.
 *
 * Returns `undefined` when no match is found.
 */
export function geocodeLocation(location: string | null | undefined): [number, number] | undefined {
  if (!location) return undefined;

  const normalized = location.trim().toLowerCase();

  // Direct match
  if (KNOWN_LOCATIONS[normalized]) return KNOWN_LOCATIONS[normalized];

  // Try removing common prefixes like "Región de "
  const withoutPrefix = normalized
    .replace(/^regi[oó]n\s+(de\s+)?/i, "")
    .trim();
  if (KNOWN_LOCATIONS[withoutPrefix]) return KNOWN_LOCATIONS[withoutPrefix];

  // Try each comma-separated part (e.g. "Valdivia, Los Ríos" → "valdivia")
  const parts = normalized.split(",").map(p => p.trim());
  for (const part of parts) {
    if (KNOWN_LOCATIONS[part]) return KNOWN_LOCATIONS[part];
    const partWithoutPrefix = part.replace(/^regi[oó]n\s+(de\s+)?/i, "").trim();
    if (KNOWN_LOCATIONS[partWithoutPrefix]) return KNOWN_LOCATIONS[partWithoutPrefix];
  }

  return undefined;
}
