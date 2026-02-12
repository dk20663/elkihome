export interface House {
  id: string;
  name: string;
  color: string;
  base_price_weekday: number;
  base_price_weekend: number;
  created_at: string;
}

export interface Booking {
  id: string;
  house_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  guest_name: string;
  guest_phone: string;
  comment: string;
  sauna: boolean;
  plunge_pool: boolean;
  bath_brooms: boolean;
  fir_infusion: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  houses?: House;
}

export interface HousePricing {
  id: string;
  house_id: string;
  date: string;
  price: number;
}

export type HouseFilter = 'all' | 'green' | 'black';

export interface BookingFormData {
  house_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  guest_name: string;
  guest_phone: string;
  comment: string;
  sauna: boolean;
  plunge_pool: boolean;
  bath_brooms: boolean;
  fir_infusion: boolean;
}
