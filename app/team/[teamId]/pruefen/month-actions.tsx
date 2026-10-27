"use client";

import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { approveAll, openMonth, publishMonth } from "./actions";

/**
 * A button that asks once before it acts: the first tap shows what will
 * happen, the second does it.
 */
function ConfirmButton({
  label,
  question,
  confirmLabel,
  variant = "primary",
  action,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  variant?: "primary" | "secondary";
  action: () => Promise<{ error?: string }>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run() {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      setAsking(false);
    });
  }

  if (!asking) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" variant={variant} onClick={() => setAsking(true)}>
          {label}
        </Button>
        {error ? <FormMessage error>{error}</FormMessage> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-brand p-4">
      <p role="status">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? "Bitte warten …" : confirmLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

export function ApproveAllButton({
  teamId,
  planningMonthId,
  openOffers,
}: {
  teamId: string;
  planningMonthId: string;
  openOffers: number;
}) {
  return (
    <ConfirmButton
      variant="secondary"
      label="Alle bestätigen"
      question={
        openOffers === 1
          ? "1 offenes Angebot bestätigen?"
          : `Alle ${openOffers} offenen Angebote bestätigen, auch die verspäteten?`
      }
      confirmLabel="Ja, bestätigen"
      action={() => approveAll(teamId, planningMonthId)}
    />
  );
}

export function PublishButton({
  teamId,
  planningMonthId,
  openOffers,
  daysWithGap,
}: {
  teamId: string;
  planningMonthId: string;
  openOffers: number;
  daysWithGap: number;
}) {
  const warnings = [
    openOffers > 0 ? `${openOffers} Angebote sind noch nicht entschieden.` : "",
    daysWithGap > 0 ? `${daysWithGap} Tage haben noch Lücken.` : "",
  ].filter(Boolean);
  return (
    <ConfirmButton
      label="Dienstplan veröffentlichen"
      question={[
        ...warnings,
        "Danach sehen alle Assistent*innen ihre Schichten. Du kannst einzelne Einträge später noch ändern.",
      ].join(" ")}
      confirmLabel="Veröffentlichen"
      action={() => publishMonth(teamId, planningMonthId)}
    />
  );
}

export function OpenMonthButton({ teamId, month }: { teamId: string; month: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError((await openMonth(teamId, month)).error);
          })
        }
      >
        {pending ? "Wird geöffnet …" : "Planung öffnen"}
      </Button>
      {error ? <FormMessage error>{error}</FormMessage> : null}
    </div>
  );
}
