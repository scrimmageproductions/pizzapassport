export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  is_vip: boolean;
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
  created_at: string;
}
