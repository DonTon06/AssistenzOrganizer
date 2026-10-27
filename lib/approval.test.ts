import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonths,
  buildApprovalDays,
  datesOfMonth,
  formatHours,
  nextMonthStart,
  parseMonthParam,
  summarize,
  weekdayIndex,
  type ApprovalOffer,
} from "./approval.ts";

function offer(overrides: Partial<ApprovalOffer>): ApprovalOffer {
  return {
    id: crypto.randomUUID(),
    date: "2026-12-01",
    assistantId: "a",
    assistantName: "Anna",
    hours: 12,
    size: 0.5,
    note: null,
    status: "submitted",
    isLate: false,
    decisionComment: null,
    ...overrides,
  };
}

test("month helpers", () => {
  assert.equal(parseMonthParam("2026-12"), "2026-12-01");
  assert.equal(parseMonthParam("2026-13"), null);
  assert.equal(parseMonthParam(undefined), null);
  assert.equal(nextMonthStart("2026-12-17"), "2027-01-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
  assert.equal(datesOfMonth("2027-02-01").length, 28);
  assert.equal(datesOfMonth("2028-02-01").at(-1), "2028-02-29");
  // 1 Dec 2026 is a Tuesday.
  assert.equal(weekdayIndex("2026-12-01"), 1);
});

test("days sum needed, offered and approved hours and mark gaps", () => {
  const days = buildApprovalDays(
    "2026-12-01",
    [
      { date: "2026-12-01", hours: 24 },
      { date: "2026-12-02", hours: 6 },
    ],
    [
      offer({ date: "2026-12-01", status: "approved", assistantName: "Ben" }),
      offer({ date: "2026-12-01", status: "submitted", hours: 6, size: 0.25 }),
      offer({ date: "2026-12-01", status: "declined", hours: 24, size: 1 }),
      offer({ date: "2026-12-01", status: "withdrawn" }),
      offer({ date: "2026-12-02", status: "approved", hours: 24, size: 1 }),
    ],
  );

  assert.equal(days.length, 31);
  const [first, second, third] = days;
  assert.deepEqual(
    { needed: first.needed, offered: first.offered, approved: first.approved, gap: first.gap, pending: first.pending },
    { needed: 24, offered: 18, approved: 12, gap: 12, pending: 6 },
  );
  // Withdrawn offers are hidden; open ones come first.
  assert.deepEqual(first.offers.map((o) => o.status), ["submitted", "approved", "declined"]);
  // More approved than needed is no negative gap.
  assert.equal(second.gap, 0);
  // A day without a need set has no gap.
  assert.deepEqual([third.needed, third.gap], [0, 0]);

  const summary = summarize(days);
  assert.equal(summary.neededHours, 30);
  assert.equal(summary.gapHours, 12);
  assert.equal(summary.daysWithGap, 1);
  assert.equal(summary.openOffers, 1);
});

test("hours are written the German way", () => {
  assert.equal(formatHours(6), "6 Std.");
  assert.equal(formatHours(7.5), "7,5 Std.");
});
