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
