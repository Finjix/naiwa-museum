export const ADMIN_SECTIONS = ["dashboard", "works", "artists", "eras", "site", "logs", "quiz", "assets", "feedback"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
