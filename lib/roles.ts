import type { Enums } from "@/lib/database.types";

export type TeamRole = Enums<"team_role">;
export type OfferStatus = Enums<"offer_status">;
export type MonthStatus = Enums<"month_status">;

/** German UI labels, as in the spec. */
export const ROLE_LABELS: Record<TeamRole, string> = {
  employer: "Arbeitgeber*in",
  proxy: "Vertretung",
  assistant: "Assistent*in",
};

export const MONTH_STATUS_LABELS: Record<MonthStatus, string> = {
  open: "Angebote offen",
  in_review: "In Prüfung",
  published: "Veröffentlicht",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  submitted: "Abgegeben",
  approved: "Bestätigt",
  declined: "Abgelehnt",
  withdrawn: "Zurückgezogen",
  handed_over: "Übergeben",
};

export const SWAP_REASON_LABELS: Record<Enums<"swap_reason">, string> = {
  swap: "Tausch",
  sick: "Krank",
};

export const SWAP_STATUS_LABELS: Record<Enums<"swap_status">, string> = {
  open: "Offen",
  accepted: "Übernommen, wartet auf Freigabe",
  authorized: "Freigegeben",
  declined: "Abgelehnt",
  withdrawn: "Zurückgezogen",
};

/** Label for offers made after the deadline. */
export const LATE_LABEL = "verspätet";

/**
 * Offer sizes are amounts of time, not fixed slots: a half day means 12 hours
 * somewhere in that day, so two half days on one date can both be approved.
 * A whole day is 24 hours. The database stores the fraction and derives hours,
 * so a day's coverage is the sum of approved hours.
 */
export const HOURS_PER_DAY = 24;

export const OFFER_SIZES = [
  { value: 1, hours: 24, label: "Ganzer Tag" },
  { value: 0.5, hours: 12, label: "Halber Tag" },
  { value: 0.25, hours: 6, label: "Viertel Tag" },
] as const;

export type OfferSize = (typeof OFFER_SIZES)[number]["value"];
