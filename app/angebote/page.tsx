import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { SetupNotice } from "@/components/setup-notice";
import { Card, PageShell } from "@/components/ui";
import { getMemberships, requireUser } from "@/lib/auth";
import {
  addMonths,
  berlinToday,
  daysBetween,
  formatDayShort,
  formatMonthName,
  monthParam,
  monthStart,
  parseMonthParam,
} from "@/lib/dates";
import { LATE_LABEL, MONTH_STATUS_LABELS, type OfferSize } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { OfferCalendar } from "./offer-calendar";
import type { CalendarDay, OtherTeamShift, OwnOffer } from "./types";

export const metadata: Metadata = { title: "Angebote abgeben" };

// "Angebote abgeben": assistants tap the days they can work and offer a whole,
// half or quarter day. Opens on next month; the current month stays reachable
// for late offers ("verspätet") until it ends.
export default async function OffersPage({ searchParams }: PageProps<"/angebote">) {
  if (!getSupabaseEnv()) return <SetupNotice />;

  const user = await requireUser();
  const params = await searchParams;
  const memberships = await getMemberships(user.id);
  const teams = memberships.filter((m) => m.role === "assistant");

  if (teams.length === 0) {
    return (
      <Screen>
        <Card>
          <p>Angebote geben Assistent*innen ab. Du bist in keinem Team als Assistent*in.</p>
        </Card>
      </Screen>
    );
  }

  const team = teams.find((t) => t.teamId === params.team) ?? teams[0];
  const today = berlinToday();
  const thisMonth = monthStart(today);
  const nextMonth = addMonths(today, 1);
  const requested = parseMonthParam(typeof params.monat === "string" ? params.monat : undefined);
  const month = requested === thisMonth ? thisMonth : nextMonth;
  const monthEnd = addMonths(month, 1);

  const supabase = await createClient();
  const { data: planningMonthId, error: openError } = await supabase.rpc("open_offer_month", {
    p_team_id: team.teamId,
    p_month: month,
  });
  if (openError || !planningMonthId) throw openError ?? new Error("Monat nicht gefunden.");

  const [planningMonth, summary, ownOffers, otherShifts] = await Promise.all([
    supabase.from("planning_months").select("deadline, status").eq("id", planningMonthId).single(),
    supabase.rpc("month_day_summary", { p_planning_month_id: planningMonthId }),
    supabase
      .from("offers")
      .select("id, date, size, hours, note, status, is_late, decision_comment, source_swap_id")
      .eq("planning_month_id", planningMonthId)
      .eq("assistant_id", user.id)
      .order("created_at"),
    supabase
      .from("offers")
      .select("date, hours, status, team_id")
      .eq("assistant_id", user.id)
      .neq("team_id", team.teamId)
      .in("status", ["approved", "submitted"])
      .gte("date", month)
      .lt("date", monthEnd),
  ]);
  for (const result of [planningMonth, summary, ownOffers, otherShifts]) {
    if (result.error) throw result.error;
  }

  const { deadline, status } = planningMonth.data!;
  const isLate = today > deadline;
  const daysLeft = daysBetween(today, deadline);

  const days: CalendarDay[] = summary.data!.map((d) => ({
    date: d.date,
    hoursNeeded: d.hours_needed === null ? null : Number(d.hours_needed),
    hoursApproved: Number(d.hours_approved),
  }));
  const offers: OwnOffer[] = ownOffers.data!.map((o) => ({
    id: o.id,
    date: o.date,
    size: Number(o.size) as OfferSize,
    hours: Number(o.hours),
    note: o.note ?? "",
    status: o.status,
    isLate: o.is_late,
    decisionComment: o.decision_comment,
    fromSwap: o.source_swap_id !== null,
  }));
  const others: OtherTeamShift[] = otherShifts.data!.map((o) => ({
    date: o.date,
    teamName: memberships.find((m) => m.teamId === o.team_id)?.teamName ?? "anderes Team",
    hours: Number(o.hours),
    approved: o.status === "approved",
  }));

  const link = (teamId: string, m: string) => `/angebote?team=${teamId}&monat=${monthParam(m)}`;

  return (
    <Screen>
      {teams.length > 1 ? (
        <nav aria-label="Team wählen" className="mb-4">
          <ul className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <li key={t.teamId}>
                <PillLink href={link(t.teamId, month)} current={t.teamId === team.teamId}>
                  {t.teamName}
                </PillLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <nav aria-label="Monat wählen" className="mb-4">
        <ul className="grid grid-cols-2 gap-2">
          {[thisMonth, nextMonth].map((m) => (
            <li key={m}>
              <PillLink href={link(team.teamId, m)} current={m === month} wide>
                {formatMonthName(m)}
              </PillLink>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="mb-6">
        <h2 className="text-xl font-semibold">
          {formatMonthName(month)} bei {team.teamName}
        </h2>
        <p className="text-muted">{MONTH_STATUS_LABELS[status]}</p>
        {isLate ? (
          <p className="mt-2 font-semibold" role="note">
            Die Frist war am {formatDayShort(deadline)}. Neue Angebote kommen noch an und werden als
            „{LATE_LABEL}“ markiert.
          </p>
        ) : (
          <p className="mt-2">
            Frist: <strong>{formatDayShort(deadline)}</strong>{" "}
            {daysLeft === 0 ? "(heute)" : daysLeft === 1 ? "(morgen)" : `(noch ${daysLeft} Tage)`}
          </p>
        )}
      </Card>

      <OfferCalendar
        key={`${team.teamId}-${month}`}
        teamId={team.teamId}
        planningMonthId={planningMonthId}
        today={today}
        isLate={isLate}
        days={days}
        offers={offers}
        otherTeams={others}
      />
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <PageShell>
        <p className="mb-2">
          <Link href="/" className="font-semibold text-brand underline">
            Zurück zum Start
          </Link>
        </p>
        <h1 className="mb-4 text-3xl font-bold">Angebote abgeben</h1>
        {children}
      </PageShell>
    </>
  );
}

function PillLink({
  href,
  current,
  wide,
  children,
}: {
  href: string;
  current: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-brand px-4 text-lg font-semibold ${
        wide ? "w-full" : ""
      } ${current ? "bg-brand text-brand-foreground" : "text-brand"}`}
    >
      {children}
    </Link>
  );
}
