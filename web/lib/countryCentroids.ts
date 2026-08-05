/**
 * Approximate country centroids (lat, lng), used only to place a dot for
 * the global activity map — not for anything precision-sensitive. Keyed by
 * the English country name as returned by OpenStreetMap Nominatim's
 * reverse-geocode `address.country` field (see lib/geo.ts), since that's
 * what gets stored on `entries.country` at check-in time.
 *
 * Deliberately country-level (not per-entry coordinates): aggregating to a
 * country centroid keeps individual users' exact check-in locations off a
 * page anyone on the internet can load.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  "United States": [39.8, -98.6],
  "United States of America": [39.8, -98.6],
  Canada: [56.1, -106.3],
  Mexico: [23.6, -102.5],
  Brazil: [-14.2, -51.9],
  Argentina: [-38.4, -63.6],
  Chile: [-35.7, -71.5],
  Colombia: [4.6, -74.3],
  Peru: [-9.2, -75.0],
  "United Kingdom": [55.4, -3.4],
  Ireland: [53.4, -8.2],
  France: [46.2, 2.2],
  Germany: [51.2, 10.5],
  Italy: [41.9, 12.6],
  Spain: [40.5, -3.7],
  Portugal: [39.4, -8.2],
  Netherlands: [52.1, 5.3],
  Belgium: [50.5, 4.5],
  Switzerland: [46.8, 8.2],
  Austria: [47.5, 14.6],
  Poland: [51.9, 19.1],
  Sweden: [60.1, 18.6],
  Norway: [60.5, 8.5],
  Denmark: [56.3, 9.5],
  Finland: [61.9, 25.7],
  Greece: [39.1, 21.8],
  Turkey: [38.9, 35.2],
  "Türkiye": [38.9, 35.2],
  Russia: [61.5, 105.3],
  Ukraine: [48.4, 31.2],
  Romania: [45.9, 24.9],
  "Czech Republic": [49.8, 15.5],
  Czechia: [49.8, 15.5],
  Hungary: [47.2, 19.5],
  Croatia: [45.1, 15.2],
  Iceland: [64.9, -19.0],
  "South Africa": [-30.6, 22.9],
  Egypt: [26.8, 30.8],
  Nigeria: [9.1, 8.7],
  Kenya: [-0.02, 37.9],
  Morocco: [31.8, -7.1],
  China: [35.9, 104.2],
  Japan: [36.2, 138.3],
  "South Korea": [35.9, 127.8],
  India: [20.6, 79.0],
  Indonesia: [-0.8, 113.9],
  Thailand: [15.9, 101.0],
  Vietnam: [14.1, 108.3],
  Philippines: [12.9, 121.8],
  Malaysia: [4.2, 101.9],
  Singapore: [1.35, 103.8],
  "Sri Lanka": [7.9, 80.8],
  Israel: [31.0, 34.9],
  "Saudi Arabia": [23.9, 45.1],
  "United Arab Emirates": [23.4, 53.8],
  Australia: [-25.3, 133.8],
  "New Zealand": [-40.9, 174.9],
  Pakistan: [30.4, 69.3],
  Bangladesh: [23.7, 90.4],
};

/** Total check-ins below this don't get a dot — keeps a sparse activity
 * map from being cluttered by single-digit outliers. */
export const MIN_CHECKINS_TO_PLOT = 1;
