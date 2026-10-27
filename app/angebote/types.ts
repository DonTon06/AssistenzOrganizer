import type { OfferSize, OfferStatus } from "@/lib/roles";

/** One of the caller's own offers in the planning month. */
export type OwnOffer = {
  id: string;
  date: string;
  size: OfferSize;
  hours: number;
  note: string;
  status: OfferStatus;
  isLate: boolean;
  decisionComment: string | null;
  /** Taken over from a colleague through a swap. */
  fromSwap: boolean;
};

/** A day of the planning month as the offer calendar shows it. */
export type CalendarDay = {
  date: string;
  /** Hours of assistance the day needs, null while the employer has not set it. */
  hoursNeeded: number | null;
  /** Approved hours of the whole team. */
  hoursApproved: number;
};

/** The caller's own approved or pending shifts in their other teams on one day. */
export type OtherTeamShift = {
  date: string;
  teamName: string;
  hours: number;
  approved: boolean;
};

/** One change the assistant submits. */
export type OfferChange =
  | { kind: "add"; date: string; size: OfferSize; note: string }
  | { kind: "update"; offerId: string; date: string; size: OfferSize; note: string }
  | { kind: "withdraw"; offerId: string; date: string };
