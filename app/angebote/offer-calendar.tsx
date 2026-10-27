"use client";

import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { formatDayLong, formatHours, weekdayIndex } from "@/lib/dates";
import { LATE_LABEL, OFFER_SIZES, OFFER_STATUS_LABELS, type OfferSize } from "@/lib/roles";
import { saveOffers, type SaveOffersResult } from "./actions";
import type { CalendarDay, OfferChange, OtherTeamShift, OwnOffer } from "./types";

type Draft = { size: OfferSize; note: string };

const WEEKDAYS = [
  ["Mo", "Montag"],
  ["Di", "Dienstag"],
  ["Mi", "Mittwoch"],
  ["Do", "Donnerstag"],
  ["Fr", "Freitag"],
  ["Sa", "Samstag"],
  ["So", "Sonntag"],
] as const;

const SIZE_SHORT: Record<OfferSize, string> = { 1: "ganz", 0.5: "½", 0.25: "¼" };

function sizeLabel(size: OfferSize) {
  return OFFER_SIZES.find((s) => s.value === size)!.label;
}

/** The offer the assistant made for a day that is still live (not withdrawn or declined). */
function liveOffers(offers: OwnOffer[]) {
  const live = new Map<string, OwnOffer>();
  for (const o of offers) {
    if (!o.fromSwap && (o.status === "submitted" || o.status === "approved")) live.set(o.date, o);
  }
  return live;
}

function initialDrafts(offers: OwnOffer[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const o of liveOffers(offers).values()) {
    if (o.status === "submitted") drafts[o.date] = { size: o.size, note: o.note };
  }
  return drafts;
}

/**
 * The month calendar of "Angebote abgeben". Pick a size, tap the days, adjust
 * single days in the list below, then submit. Nothing is saved before "Absenden".
 */
export function OfferCalendar({
  teamId,
  planningMonthId,
  today,
  isLate,
  days,
  offers,
  otherTeams,
}: {
  teamId: string;
  planningMonthId: string;
  today: string;
  isLate: boolean;
  days: CalendarDay[];
  offers: OwnOffer[];
  otherTeams: OtherTeamShift[];
}) {
  const [size, setSize] = useState<OfferSize>(1);
  const [drafts, setDrafts] = useState(() => initialDrafts(offers));
  const [savedOffers, setSavedOffers] = useState(offers);
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<SaveOffersResult>();
  const [pending, startTransition] = useTransition();

  // After saving, the server sends fresh offers: start over from them.
  if (savedOffers !== offers) {
    setSavedOffers(offers);
    setDrafts(initialDrafts(offers));
  }

  const live = liveOffers(offers);
  const swapShifts = offers.filter((o) => o.fromSwap && o.status === "approved");
  const declined = new Map(offers.filter((o) => o.status === "declined").map((o) => [o.date, o]));
  const dayInfo = new Map(days.map((d) => [d.date, d]));
  const clashes = new Map<string, OtherTeamShift[]>();
  for (const s of otherTeams) clashes.set(s.date, [...(clashes.get(s.date) ?? []), s]);

  const changes: OfferChange[] = [];
  for (const [date, draft] of Object.entries(drafts)) {
    const existing = live.get(date);
    if (!existing) {
      changes.push({ kind: "add", date, ...draft });
    } else if (existing.size !== draft.size || existing.note !== draft.note) {
      changes.push({ kind: "update", offerId: existing.id, date, ...draft });
    }
  }
  for (const o of live.values()) {
    if (o.status === "submitted" && !drafts[o.date]) {
      changes.push({ kind: "withdraw", offerId: o.id, date: o.date });
    }
  }
  changes.sort((a, b) => a.date.localeCompare(b.date));

  function isLocked(date: string) {
    return date < today || live.get(date)?.status === "approved";
  }

  function openHours(date: string) {
    const info = dayInfo.get(date);
    if (!info || info.hoursNeeded === null) return null;
    return Math.max(0, info.hoursNeeded - info.hoursApproved);
  }

  function clashText(date: string) {
    const list = clashes.get(date) ?? [];
    const approved = list.filter((s) => s.approved);
    const pendingElsewhere = list.filter((s) => !s.approved);
    const parts: string[] = [];
    if (approved.length) {
      parts.push(
        `Achtung: Du hast an diesem Tag schon eine bestätigte Schicht bei ${approved
          .map((s) => `${s.teamName} (${formatHours(s.hours)})`)
          .join(", ")}.`,
      );
    }
    if (pendingElsewhere.length) {
      parts.push(
        `Du hast diesen Tag auch bei ${pendingElsewhere.map((s) => s.teamName).join(", ")} angeboten.`,
      );
    }
    return parts.join(" ");
  }

  function toggleDay(date: string) {
    if (isLocked(date)) {
      document.getElementById(`tag-${date}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    const current = drafts[date];
    const next = { ...drafts };
    let message: string;
    if (!current) {
      next[date] = { size, note: "" };
      message = `${formatDayLong(date)}: ${sizeLabel(size)} ausgewählt.`;
    } else if (current.size !== size) {
      next[date] = { ...current, size };
      message = `${formatDayLong(date)}: geändert auf ${sizeLabel(size)}.`;
    } else {
      delete next[date];
      message = `${formatDayLong(date)}: abgewählt.`;
    }
    const clash = next[date] ? clashText(date) : "";
    setDrafts(next);
    setResult(undefined);
    setAnnouncement(clash ? `${message} ${clash}` : message);
  }

  function updateDraft(date: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [date]: { ...d[date], ...patch } }));
    setResult(undefined);
  }

  function removeDraft(date: string) {
    setDrafts((d) => {
      const next = { ...d };
      delete next[date];
      return next;
    });
    setResult(undefined);
  }

  // Undo a pending withdrawal, or offer a declined day again.
  function addBack(date: string) {
    const existing = live.get(date);
    if (existing) {
      setDrafts((d) => ({ ...d, [date]: { size: existing.size, note: existing.note } }));
      setResult(undefined);
    } else {
      toggleDay(date);
    }
  }

  function submit() {
    startTransition(async () => {
      setResult(await saveOffers(teamId, planningMonthId, changes));
    });
  }

  // Days that get an entry in the list below the calendar.
  const listed = new Set([
    ...Object.keys(drafts),
    ...[...live.values()].map((o) => o.date),
    ...swapShifts.map((o) => o.date),
    ...[...declined.keys()].filter((d) => d >= today),
  ]);
  const listDays = [...listed].sort();
  const leadingBlanks = days.length ? weekdayIndex(days[0].date) : 0;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <fieldset>
        <legend className="mb-2 text-lg font-semibold">Was möchtest du anbieten?</legend>
        <div className="grid grid-cols-3 gap-2">
          {OFFER_SIZES.map((s) => (
            <label
              key={s.value}
              className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-brand px-1 text-center font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                size === s.value ? "bg-brand text-brand-foreground" : "text-brand"
              }`}
            >
              <input
                type="radio"
                name="groesse"
                value={s.value}
                checked={size === s.value}
                onChange={() => setSize(s.value)}
                className="sr-only"
              />
              <span>{s.label}</span>
              <span className="text-sm font-normal">{formatHours(s.hours)}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-muted">
          Tippe dann auf die Tage, an denen du arbeiten kannst. Nochmal tippen wählt den Tag ab.
          Ein halber Tag ist eine Menge Zeit (12 Std.), keine feste Tageshälfte.
        </p>
      </fieldset>

      <section aria-labelledby="kalender-titel">
        <h2 id="kalender-titel" className="sr-only">
          Kalender
        </h2>
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-muted" aria-hidden>
          {WEEKDAYS.map(([short]) => (
            <span key={short}>{short}</span>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <li key={`leer-${i}`} aria-hidden />
          ))}
          {days.map(({ date }) => {
            const draft = drafts[date];
            const offer = live.get(date);
            const approved = offer?.status === "approved";
            const swapHours = swapShifts
              .filter((o) => o.date === date)
              .reduce((sum, o) => sum + o.hours, 0);
            const past = date < today;
            const open = openHours(date);
            const clash = clashes.get(date)?.some((s) => s.approved);
            const shownSize = draft?.size ?? (approved ? offer.size : undefined);

            const label = [
              formatDayLong(date),
              draft ? `ausgewählt: ${sizeLabel(draft.size)}` : null,
              approved ? `bestätigt: ${sizeLabel(offer.size)}` : null,
              swapHours ? `übernommene Schicht ${formatHours(swapHours)}` : null,
              open === null ? null : open === 0 ? "Bedarf gedeckt" : `${formatHours(open)} offen`,
              clash ? "Achtung, bestätigte Schicht in einem anderen Team" : null,
              past ? "vorbei" : null,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => toggleDay(date)}
                  aria-pressed={past || approved ? undefined : Boolean(draft)}
                  aria-label={label}
                  className={`relative flex min-h-16 w-full flex-col items-center justify-start rounded-lg border-2 pb-1 pt-0.5 ${
                    draft
                      ? "border-brand bg-brand text-brand-foreground"
                      : approved || swapHours
                        ? "border-brand bg-surface"
                        : "border-border bg-background"
                  } ${past ? "opacity-50" : ""}`}
                >
                  <span className="text-base font-semibold">{Number(date.slice(8))}</span>
                  {shownSize !== undefined ? (
                    <span className="text-sm font-bold leading-tight">
                      {approved ? "✓ " : ""}
                      {SIZE_SHORT[shownSize]}
                    </span>
                  ) : swapHours ? (
                    <span className="text-sm font-bold leading-tight">✓</span>
                  ) : open !== null && !past ? (
                    <span className="text-xs leading-tight">{open === 0 ? "✓" : `${open} h`}</span>
                  ) : null}
                  {clash ? (
                    <span className="absolute right-0.5 top-0 text-xs" aria-hidden>
                      ⚠
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-muted">
          Unter dem Datum: noch offene Stunden des Tages. Hell hinterlegt mit ✓: bestätigt. ⚠: du
          hast schon eine bestätigte Schicht in einem anderen Team.
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </section>

      <section aria-labelledby="auswahl-titel">
        <h2 id="auswahl-titel" className="mb-3 text-xl font-semibold">
          Deine Angebote
        </h2>
        {listDays.length === 0 ? (
          <p className="text-muted">Noch keine Tage ausgewählt.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listDays.map((date) => (
              <DayEntry
                key={date}
                date={date}
                draft={drafts[date]}
                offer={live.get(date)}
                declined={declined.get(date)}
                swapShifts={swapShifts.filter((o) => o.date === date)}
                openHours={openHours(date)}
                hoursNeeded={dayInfo.get(date)?.hoursNeeded ?? null}
                clash={clashText(date)}
                isLate={isLate}
                onChange={(patch) => updateDraft(date, patch)}
                onRemove={() => removeDraft(date)}
                onAdd={() => addBack(date)}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-3">
          {result ? (
            result.errors.length ? (
              <div role="alert" className="font-semibold text-danger">
                <p>
                  {result.saved > 0 ? `${result.saved} gespeichert, aber: ` : "Nicht gespeichert: "}
                </p>
                <ul className="list-disc pl-5">
                  {result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <FormMessage>
                {result.saved === 1 ? "1 Änderung abgesendet." : `${result.saved} Änderungen abgesendet.`}
              </FormMessage>
            )
          ) : null}
          <Button type="button" onClick={submit} disabled={pending || changes.length === 0}>
            {pending
              ? "Wird abgesendet …"
              : changes.length === 0
                ? "Alles abgesendet"
                : `Angebote absenden (${changes.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayEntry({
  date,
  draft,
  offer,
  declined,
  swapShifts,
  openHours,
  hoursNeeded,
  clash,
  isLate,
  onChange,
  onRemove,
  onAdd,
}: {
  date: string;
  draft?: Draft;
  offer?: OwnOffer;
  declined?: OwnOffer;
  swapShifts: OwnOffer[];
  openHours: number | null;
  hoursNeeded: number | null;
  clash: string;
  isLate: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const id = `tag-${date}`;
  const changed = draft && offer && (offer.size !== draft.size || offer.note !== draft.note);
  const withdrawn = offer?.status === "submitted" && !draft;

  let status: string;
  if (offer?.status === "approved") status = `${OFFER_STATUS_LABELS.approved}: ${sizeLabel(offer.size)}`;
  else if (withdrawn) status = "Wird zurückgezogen (noch nicht abgesendet)";
  else if (changed) status = "Geändert (noch nicht abgesendet)";
  else if (offer) status = OFFER_STATUS_LABELS.submitted;
  else if (draft) status = "Neu (noch nicht abgesendet)";
  else if (swapShifts.length) status = `Übernommene Schicht: ${formatHours(swapShifts.reduce((s, o) => s + o.hours, 0))}`;
  else status = `${OFFER_STATUS_LABELS.declined}: ${sizeLabel(declined!.size)}`;

  const late = offer ? offer.isLate : Boolean(draft) && isLate;

  return (
    <li id={id} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-lg font-semibold">{formatDayLong(date)}</h3>
      <p>
        {status}
        {late ? (
          <span className="ml-2 rounded-md border border-foreground px-1.5 text-sm font-semibold">
            {LATE_LABEL}
          </span>
        ) : null}
      </p>
      {hoursNeeded !== null ? (
        <p className="text-sm text-muted">
          Bedarf {formatHours(hoursNeeded)}
          {openHours !== null ? `, davon ${openHours === 0 ? "nichts" : formatHours(openHours)} offen` : ""}
        </p>
      ) : null}
      {offer?.status === "approved" && offer.note ? <p className="text-sm">Notiz: {offer.note}</p> : null}
      {offer?.decisionComment ? (
        <p className="text-sm">Kommentar: {offer.decisionComment}</p>
      ) : !offer && declined?.decisionComment ? (
        <p className="text-sm">Kommentar: {declined.decisionComment}</p>
      ) : null}
      {clash ? (
        <p className="mt-2 font-semibold text-danger" role="note">
          ⚠ {clash}
        </p>
      ) : null}

      {draft ? (
        <div className="mt-3 flex flex-col gap-3">
          <fieldset>
            <legend className="sr-only">Umfang am {formatDayLong(date)}</legend>
            <div className="grid grid-cols-3 gap-2">
              {OFFER_SIZES.map((s) => (
                <label
                  key={s.value}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-brand px-1 text-center font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                    draft.size === s.value ? "bg-brand text-brand-foreground" : "text-brand"
                  }`}
                >
                  <input
                    type="radio"
                    name={`groesse-${date}`}
                    value={s.value}
                    checked={draft.size === s.value}
                    onChange={() => onChange({ size: s.value })}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor={`notiz-${date}`} className="font-semibold">
              Notiz (freiwillig)
            </label>
            <input
              id={`notiz-${date}`}
              value={draft.note}
              maxLength={500}
              placeholder="z. B. ab 14 Uhr"
              onChange={(e) => onChange({ note: e.target.value })}
              className="min-h-12 rounded-xl border-2 border-border bg-background px-4 text-lg"
            />
          </div>
          <Button type="button" variant="secondary" onClick={onRemove}>
            {offer ? "Angebot zurückziehen" : "Tag abwählen"}
          </Button>
        </div>
      ) : withdrawn || (!offer && declined && !swapShifts.length) ? (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={onAdd}>
            {withdrawn ? "Doch nicht zurückziehen" : "Neu anbieten"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
