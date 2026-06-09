/**
 * Single source of truth for booking contact channels.
 * Used by guest view (in-app) and the public embed widget for elkihome24.ru.
 */
export interface ContactChannel {
  id: string;
  label: string;
  url: string;
  /** Tailwind background class for the button */
  className?: string;
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: "telegram",
    label: "Telegram",
    url: "https://t.me/elki_home24",
  },
  {
    id: "max",
    label: "MAX",
    url: "https://max.ru/u/f9LHodD0cOKE5LYXEyJe_Iren91XSVwVMpIFE1SqrYny5BOIgJdZsJkhEVY",
  },
];

/** Primary channel (used where only one CTA fits) */
export const PRIMARY_CONTACT = CONTACT_CHANNELS[0];
