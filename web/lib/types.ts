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
  created_at: string;
}

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
  ink_color: string;
  /** Geocoded venue id (see lib/geo.ts) — null for manually-typed entries. */
  place_id: string | null;
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
