// Pure helpers for the approval screen (Angebote prüfen): month arithmetic and
// the per-day sums of hours needed, offered and approved. No imports, so the
// unit tests run with plain `node --test`.

export type ApprovalOffer = {
  id: string;
  date: string;
  assistantId: string;
  assistantName: string;
  hours: number;
  size: number;
  note: string | null;
  status: "submitted" | "approved" | "declined" | "withdrawn" | "handed_over";
  isLate: boolean;
  decisionComment: string | null;
};

export type ApprovalDay = {
  date: string;
  /** Hours of assistance the day needs (Tagesbedarf); 0 when none is set. */
  needed: number;
  /** Hours of all live offers, open or approved. */
  offered: number;
  approved: number;
  /** Hours still uncovered by approved offers. */
  gap: number;
  /** Hours that are still open but already offered and undecided. */
  pending: number;
  offers: ApprovalOffer[];
};

/** "2026-12" → "2026-12-01", or null if the value is not a month. */
export function parseMonthParam(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return `${value}-01`;
}

/** "2026-12-01" → "2026-12". */
export function toMonthParam(month: string): string {
  return month.slice(0, 7);
}

/** First day of the month after the one `today` (YYYY-MM-DD) falls in. */
export function nextMonthStart(today: string): string {
  return addMonths(`${today.slice(0, 7)}-01`, 1);
}

/** Adds whole months to a first-of-month date. */
export function addMonths(month: string, count: number): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + count;
  const date = new Date(Date.UTC(year, index, 1));
  return date.toISOString().slice(0, 10);
}

/** All dates (YYYY-MM-DD) of the month that starts on `month`. */
export function datesOfMonth(month: string): string[] {
  const next = addMonths(month, 1);
  const dates: string[] = [];
  for (let d = new Date(`${month}T00:00:00Z`); d.toISOString().slice(0, 10) < next; ) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86_400_000);
  }
  return dates;
}

/** Weekday with Monday = 0, as in German calendars. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * One entry per day of the month. Withdrawn and handed-over offers are left
 * out; declined offers stay in the list so a decision can be changed, but do
 * not count as offered hours.
 */
export function buildApprovalDays(
  month: string,
  needs: { date: string; hours: number }[],
  offers: ApprovalOffer[],
): ApprovalDay[] {
  const neededByDate = new Map(needs.map((n) => [n.date, Number(n.hours)]));
  const offersByDate = new Map<string, ApprovalOffer[]>();
  for (const offer of offers) {
    if (offer.status === "withdrawn" || offer.status === "handed_over") continue;
    const list = offersByDate.get(offer.date) ?? [];
    list.push(offer);
    offersByDate.set(offer.date, list);
  }

  return datesOfMonth(month).map((date) => {
    const dayOffers = (offersByDate.get(date) ?? []).sort(compareOffers);
    const needed = neededByDate.get(date) ?? 0;
    const sum = (status: ApprovalOffer["status"]) =>
      dayOffers.filter((o) => o.status === status).reduce((total, o) => total + o.hours, 0);
    const approved = sum("approved");
    const submitted = sum("submitted");
    const gap = Math.max(0, needed - approved);
    return {
      date,
      needed,
      offered: approved + submitted,
      approved,
      gap,
      pending: Math.min(gap, submitted),
      offers: dayOffers,
    };
  });
}

// Open offers first, then by name, so the ones still to decide are on top.
function compareOffers(a: ApprovalOffer, b: ApprovalOffer) {
  const rank = (o: ApprovalOffer) => (o.status === "submitted" ? 0 : o.status === "approved" ? 1 : 2);
  return rank(a) - rank(b) || a.assistantName.localeCompare(b.assistantName, "de");
}

export type ApprovalSummary = {
  neededHours: number;
  approvedHours: number;
  gapHours: number;
  daysWithGap: number;
  openOffers: number;
  openLateOffers: number;
};

export function summarize(days: ApprovalDay[]): ApprovalSummary {
  const offers = days.flatMap((d) => d.offers).filter((o) => o.status === "submitted");
  return {
    neededHours: days.reduce((t, d) => t + d.needed, 0),
    approvedHours: days.reduce((t, d) => t + d.approved, 0),
    gapHours: days.reduce((t, d) => t + d.gap, 0),
    daysWithGap: days.filter((d) => d.gap > 0).length,
    openOffers: offers.length,
    openLateOffers: offers.filter((o) => o.isLate).length,
  };
}

/** "6 Std." with a German decimal comma for quarter hours etc. */
export function formatHours(hours: number): string {
  return `${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.`;
}
