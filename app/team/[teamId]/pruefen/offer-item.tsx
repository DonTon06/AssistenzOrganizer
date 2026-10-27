"use client";

import { useId, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { formatHours, type ApprovalOffer } from "@/lib/approval";
import { LATE_LABEL, OFFER_SIZES, OFFER_STATUS_LABELS } from "@/lib/roles";
import { decideOffer } from "./actions";

/** One offer with approve and decline buttons and an optional comment. */
export function OfferItem({
  teamId,
  offer,
  dateLabel,
}: {
  teamId: string;
  offer: ApprovalOffer;
  /** Shown in the late list, where offers of different days are mixed. */
  dateLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [comment, setComment] = useState(offer.decisionComment ?? "");
  const commentId = useId();
  const size = OFFER_SIZES.find((s) => s.value === Number(offer.size));
  const who = `${offer.assistantName}, ${size?.label ?? formatHours(offer.hours)}`;

  function decide(decision: "approved" | "declined") {
    setError(undefined);
    startTransition(async () => {
      const result = await decideOffer(teamId, offer.id, decision, comment);
      setError(result.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        {dateLabel ? <p className="font-semibold">{dateLabel}</p> : null}
        <p className="text-lg font-semibold">{offer.assistantName}</p>
        <p>
          {size?.label ?? "Angebot"} · {formatHours(offer.hours)}
        </p>
        {offer.note ? <p className="text-muted">Notiz: {offer.note}</p> : null}
        <p className="mt-1 flex flex-wrap gap-2">
          <Badge tone={offer.status === "approved" ? "ok" : offer.status === "declined" ? "muted" : "open"}>
            {OFFER_STATUS_LABELS[offer.status]}
          </Badge>
          {offer.isLate ? <Badge tone="late">{LATE_LABEL}</Badge> : null}
        </p>
      </div>

      <details open={Boolean(offer.decisionComment)}>
        <summary className="min-h-12 cursor-pointer py-3 font-semibold text-brand underline">
          {offer.decisionComment ? "Kommentar" : "Kommentar hinzufügen"}
        </summary>
        <label htmlFor={commentId} className="sr-only">
          Kommentar für {offer.assistantName}
        </label>
        <textarea
          id={commentId}
          value={comment}
          maxLength={500}
          rows={2}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-lg"
        />
      </details>

      <div className="grid grid-cols-2 gap-3">
        {offer.status !== "approved" ? (
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={pending}
            aria-label={`Bestätigen: ${who}`}
            className="min-h-12 rounded-xl bg-brand px-4 text-lg font-semibold text-brand-foreground disabled:opacity-60"
          >
            Bestätigen
          </button>
        ) : null}
        {offer.status !== "declined" ? (
          <button
            type="button"
            onClick={() => decide("declined")}
            disabled={pending}
            aria-label={`Ablehnen: ${who}`}
            className="min-h-12 rounded-xl border-2 border-brand px-4 text-lg font-semibold text-brand disabled:opacity-60"
          >
            Ablehnen
          </button>
        ) : null}
      </div>
      <p role="status" className={error ? "font-semibold text-danger" : "sr-only"}>
        {error ?? (pending ? "Wird gespeichert …" : "")}
      </p>
    </li>
  );
}
