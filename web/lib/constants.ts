/** Crust styles offered during check-in — mirrors CrustType.swift on iOS. */
export const CRUST_TYPES = [
  "Neapolitan",
  "NY Style",
  "Deep Dish",
  "Detroit",
  "Tavern",
  "Sicilian",
  "Grandma",
  "Other",
] as const;

export type CrustType = (typeof CRUST_TYPES)[number];

export type InkColor = "red" | "blue" | "charcoal";

/** Single source of truth for ink tint colors, shared by the stamp filter,
 * check-in ink picker, entry cards, and the story exporter. */
export const INK_COLORS: Record<InkColor, string> = {
  red: "#C8102E",
  blue: "#1C3D85",
  charcoal: "#1C1C1E",
};

/** Points awarded for a base check-in (venue + selfie photo) — mirrors the
 * `entries.points_earned` default in schema.sql. */
export const POINTS_BASE_CHECKIN = 100;
/** Extra points for the optional menu photo. */
export const POINTS_MENU_PHOTO_BONUS = 100;

/**
 * Major national fast-food pizza chains excluded from nearby-search
 * results, so check-ins stay focused on local/independent pizzerias.
 * Matched case-insensitively as a substring of the venue name (e.g. so
 * "Domino's Pizza #4021" and "Little Caesars Pizza" both match) — mirrors
 * the blacklist in `PizzaPassport/Services/LocationService.swift`.
 */
export const CHAIN_BLACKLIST = [
  "domino's",
  "dominos",
  "pizza hut",
  "papa john",
  "little caesars",
  "marco's pizza",
  "marcos pizza",
  "chuck e. cheese",
  "chuck e cheese",
  "cici's",
  "cicis",
  "hunt brothers",
  "sbarro",
] as const;

/** True if `name` matches a blacklisted national chain. */
export function isChainPizzeria(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_BLACKLIST.some((chain) => lower.includes(chain));
}
