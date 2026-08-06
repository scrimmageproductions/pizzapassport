export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_vip: boolean;
  is_public: boolean;
  /** true until the anonymous session is upgraded to a real account. */
  is_guest: boolean;
  claimed_at: string | null;
  /** Running total of this user's entries.points_earned — kept in sync by
   * a Postgres trigger, see schema_gamification.sql. */
  points: number;
  created_at: string;
}

/** One row of `public.leaderboard` — a public profile plus its aggregate
 * stats, joined server-side so ranking never requires summing client-side. */
export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  total_checkins: number;
}

/** One row of `public.country_activity`, used by the world map. */
export interface CountryActivity {
  country: string;
  total_checkins: number;
  total_explorers: number;
}

export type ClaimMethod = "geo" | "manual" | "qr" | "link" | "secret_word";

export interface Entry {
  id: string;
  user_id: string;
  restaurant_name: string;
  latitude: number;
  longitude: number;
  rating: number;
  crust_type: string;
  venue_photo_url: string;
  selfie_photo_url: string;
  stamp_image_url: string | null;
  /** Optional third check-in photo of the pizzeria's menu — worth a
   * points bonus, never required to complete a check-in. */
  menu_photo_url: string | null;
  /** +100 base, +100 more if menu_photo_url is set — see
   * lib/constants.ts's POINTS_* constants. */
  points_earned: number;
  ink_color: string;
  /** Geocoded venue id (see lib/geo.ts) — null only for entries saved
   * before the pizzerias migration; every new check-in always sets one. */
  place_id: string | null;
  /** Reverse-geocoded at check-in time — powers the world map. */
  country: string | null;
  /** Human-readable display serial ("Stamp No. 4821"), auto-assigned. */
  serial_number: number;
  claim_method: ClaimMethod;
  /** Set only via the `submit_owner_reply` RPC (see
   * schema_merchants.sql) — never written directly by the client. */
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
}

/** A verified pizzeria owner account — see schema_merchants.sql. Created
 * exclusively via `/api/merchants/claim`; never inserted directly by a
 * client, so `is_verified` can be trusted. */
export interface Merchant {
  id: string;
  business_name: string;
  business_email: string;
  phone_number: string | null;
  place_id: string;
  is_verified: boolean;
  official_logo_url: string | null;
  custom_stamp_ink_color: string;
  custom_stamp_style: string;
  stamp_texture_density: number;
  stamp_edge_distress: number;
  created_at: string;
}

/** One row of `public.story_share_events`, aggregated for the merchant
 * dashboard's "Total Story Shares" metric. */
export interface StoryShareEvent {
  id: string;
  entry_id: string;
  platform: string;
  created_at: string;
}

/** A venue, normalized out of entries.restaurant_name so Moments (and
 * future drops/collections) can group by place rather than free text. */
export interface Pizzeria {
  place_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

/** An optional photo + note a user attaches to a check-in after the fact. */
export interface Moment {
  id: string;
  entry_id: string;
  user_id: string;
  place_id: string | null;
  photo_url: string | null;
  note: string | null;
  created_at: string;
}

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface ActivityEvent {
  event_id: string;
  actor_id: string;
  actor_username: string;
  entry_id: string | null;
  restaurant_name: string | null;
  stamp_image_url: string | null;
  created_at: string;
}
