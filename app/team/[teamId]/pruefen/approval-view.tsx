import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import {
  formatHours,
  summarize,
  weekdayIndex,
  type ApprovalDay,
} from "@/lib/approval";
import { MONTH_STATUS_LABELS, type MonthStatus } from "@/lib/roles";
import { ApproveAllButton, PublishButton } from "./month-actions";
import { OfferItem } from "./offer-item";

// Dates are plain calendar days, so they are formatted in UTC to avoid shifts.
const dayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const timestampFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Everything below the month switcher: summary, month grid, late offers, day list. */
export function ApprovalView({
  teamId,
  planningMonth,
  days,
  onlyGaps,
  filterHref,
  today,
}: {
  teamId: string;
  planningMonth: { id: string; deadline: string; status: MonthStatus; published_at: string | null };
  days: ApprovalDay[];
  onlyGaps: boolean;
  filterHref: (onlyGaps: boolean) => string;
  /** Today in Europe/Berlin, YYYY-MM-DD. */
  today: string;
}) {
  const summary = summarize(days);
  const lateOpen = days.flatMap((d) => d.offers).filter((o) => o.status === "submitted" && o.isLate);
  const shownDays = onlyGaps ? days.filter((d) => d.gap > 0) : days;
  const published = planningMonth.status === "published";
  const deadlinePassed = today > planningMonth.deadline;

  return (
    <>
      <Card className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={published ? "ok" : "open"}>{MONTH_STATUS_LABELS[planningMonth.status]}</Badge>
          <span className="text-muted">
            Angebote bis {dayFormat.format(asDate(planningMonth.deadline))}
            {deadlinePassed ? " (vorbei)" : ""}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <dt>Bedarf</dt>
          <dd className="text-right font-semibold">{formatHours(summary.neededHours)}</dd>
          <dt>Bestätigt</dt>
          <dd className="text-right font-semibold">{formatHours(summary.approvedHours)}</dd>
          <dt>Noch offen</dt>
          <dd className="text-right font-semibold">
            {summary.gapHours > 0
              ? `${formatHours(summary.gapHours)} an ${summary.daysWithGap} ${summary.daysWithGap === 1 ? "Tag" : "Tagen"}`
              : "keine Lücken"}
          </dd>
          <dt>Nicht entschieden</dt>
          <dd className="text-right font-semibold">
            {summary.openOffers} {summary.openOffers === 1 ? "Angebot" : "Angebote"}
            {summary.openLateOffers > 0 ? `, ${summary.openLateOffers} verspätet` : ""}
          </dd>
        </dl>
        {summary.neededHours === 0 ? (
          <p className="text-muted">
            Für diesen Monat ist noch kein Tagesbedarf eingetragen, deshalb werden keine Lücken angezeigt.
          </p>
        ) : null}
        {summary.openOffers > 0 ? (
          <ApproveAllButton teamId={teamId} planningMonthId={planningMonth.id} openOffers={summary.openOffers} />
        ) : null}
        {published ? (
          <p role="status" className="font-semibold">
            Veröffentlicht
            {planningMonth.published_at ? ` am ${timestampFormat.format(new Date(planningMonth.published_at))}` : ""}.
            Änderungen sehen die Assistent*innen sofort.
          </p>
        ) : (
          <PublishButton
            teamId={teamId}
            planningMonthId={planningMonth.id}
            openOffers={summary.openOffers}
            daysWithGap={summary.daysWithGap}
          />
        )}
      </Card>

      <MonthGrid days={days} />

      {lateOpen.length > 0 ? (
        <section aria-labelledby="verspaetet" className="mb-8">
          <h2 id="verspaetet" className="mb-1 text-2xl font-bold">
            Verspätete Angebote
          </h2>
          <p className="mb-4 text-muted">Nach der Frist abgegeben. Sie können Lücken füllen.</p>
          <Card>
            <ul className="flex flex-col gap-4">
              {lateOpen.map((offer) => (
                <OfferItem
                  key={offer.id}
                  teamId={teamId}
                  offer={offer}
                  dateLabel={`${dayFormat.format(asDate(offer.date))}, ${dayGapText(days, offer.date)}`}
                />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="tage">
        <h2 id="tage" className="mb-3 text-2xl font-bold">
          Tag für Tag
        </h2>
        <nav aria-label="Tage filtern" className="mb-4 grid grid-cols-2 gap-3">
          <FilterLink href={filterHref(false)} active={!onlyGaps}>
            Alle Tage
          </FilterLink>
          <FilterLink href={filterHref(true)} active={onlyGaps}>
            Nur Lücken
          </FilterLink>
        </nav>
        {shownDays.length === 0 ? (
          <Card>
            <p>Keine Tage mit Lücken.</p>
          </Card>
        ) : (
          <ol className="flex flex-col gap-4">
            {shownDays.map((day) => (
              <li key={day.date} id={`tag-${day.date}`} className="scroll-mt-4">
                <DayCard teamId={teamId} day={day} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function gapText(day: ApprovalDay) {
  if (day.needed === 0) return day.approved > 0 ? "kein Bedarf eingetragen" : "kein Bedarf";
  return day.gap > 0 ? `${formatHours(day.gap)} offen` : "gedeckt";
}

function dayGapText(days: ApprovalDay[], date: string) {
  const day = days.find((d) => d.date === date);
  return day ? gapText(day) : "";
}

/** Month at a glance. Each day links to its entry in the list below. */
function MonthGrid({ days }: { days: ApprovalDay[] }) {
  const leading = weekdayIndex(days[0].date);
  return (
    <section aria-labelledby="monatsuebersicht" className="mb-8">
      <h2 id="monatsuebersicht" className="mb-3 text-2xl font-bold">
        Monatsübersicht
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center" role="list">
        {WEEKDAYS.map((w) => (
          <div key={w} aria-hidden="true" className="pb-1 text-sm font-semibold text-muted">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`leer-${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const hasGap = day.gap > 0;
          const open = day.offers.filter((o) => o.status === "submitted").length;
          const label = [
            dayFormat.format(asDate(day.date)),
            gapText(day),
            open > 0 ? `${open} ${open === 1 ? "Angebot" : "Angebote"} nicht entschieden` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <div key={day.date} role="listitem">
              <a
                href={`#tag-${day.date}`}
                aria-label={label}
                className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 px-0.5 leading-tight ${
                  hasGap
                    ? "border-gap bg-gap-surface text-gap"
                    : day.needed > 0
                      ? "border-transparent bg-ok-surface text-ok"
                      : "border-border text-muted"
                }`}
              >
                <span className="text-base font-bold">{Number(day.date.slice(8))}</span>
                <span className="text-xs font-semibold" aria-hidden="true">
                  {hasGap ? `−${day.gap.toLocaleString("de-DE")}` : day.needed > 0 ? "✓" : "–"}
                  {open > 0 ? " •" : ""}
                </span>
              </a>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted">
        −Zahl: offene Stunden. ✓: gedeckt. –: kein Bedarf. •: Angebote nicht entschieden.
      </p>
    </section>
  );
}

function DayCard({ teamId, day }: { teamId: string; day: ApprovalDay }) {
  const hasGap = day.gap > 0;
  return (
    <Card className={hasGap ? "border-2 border-gap" : ""}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-semibold">{dayFormat.format(asDate(day.date))}</h3>
        <Badge tone={hasGap ? "gap" : day.needed > 0 ? "ok" : "muted"}>{gapText(day)}</Badge>
      </div>
      <p className="mb-4">
        Bedarf {formatHours(day.needed)} · angeboten {formatHours(day.offered)} · bestätigt{" "}
        {formatHours(day.approved)}
      </p>
      {day.offers.length === 0 ? (
        <p className="text-muted">Keine Angebote für {shortDayFormat.format(asDate(day.date))}.</p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={`Angebote für ${dayFormat.format(asDate(day.date))}`}>
          {day.offers.map((offer) => (
            <OfferItem key={offer.id} teamId={teamId} offer={offer} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-brand px-4 font-semibold ${
        active ? "bg-brand text-brand-foreground" : "text-brand"
      }`}
    >
      {children}
    </Link>
  );
}
