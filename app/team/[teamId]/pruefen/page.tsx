import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SetupNotice } from "@/components/setup-notice";
import { Card, PageShell } from "@/components/ui";
import {
  addMonths,
  buildApprovalDays,
  nextMonthStart,
  parseMonthParam,
  toMonthParam,
  type ApprovalOffer,
} from "@/lib/approval";
import { getMemberships, isManagerRole, requireUser } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ApprovalView } from "./approval-view";
import { OpenMonthButton } from "./month-actions";

export const metadata: Metadata = { title: "Angebote prüfen" };

// The month is a plain calendar date, so it is formatted in UTC to avoid shifts.
const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

/** Angebote prüfen: the employer or proxy decides on a month's offers and publishes it. */
export default async function ApprovalPage(props: PageProps<"/team/[teamId]/pruefen">) {
  if (!getSupabaseEnv()) return <SetupNotice />;

  const { teamId } = await props.params;
  const query = await props.searchParams;
  const month = parseMonthParam(typeof query.monat === "string" ? query.monat : null)
    ?? nextMonthStart(berlinToday());
  const onlyGaps = query.ansicht === "luecken";

  const user = await requireUser();
  const membership = (await getMemberships(user.id)).find((m) => m.teamId === teamId);
  if (!membership) notFound();

  const monthName = monthFormat.format(asDate(month));
  const monthHref = (m: string, gaps = onlyGaps) =>
    `/team/${teamId}/pruefen?monat=${toMonthParam(m)}${gaps ? "&ansicht=luecken" : ""}`;

  const header = (
    <>
      <p>
        <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-brand underline">
          Zurück zum Start
        </Link>
      </p>
      <h1 className="text-3xl font-bold">Angebote prüfen</h1>
      <p className="mb-4 text-muted">{membership.teamName}</p>
      <nav aria-label="Monat wählen" className="mb-6 flex items-center justify-between gap-2">
        <Link
          href={monthHref(addMonths(month, -1))}
          className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-brand underline"
        >
          <span aria-hidden="true">‹&nbsp;</span>Vormonat
        </Link>
        <h2 className="text-center text-xl font-bold" aria-live="polite">
          {monthName}
        </h2>
        <Link
          href={monthHref(addMonths(month, 1))}
          className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-brand underline"
        >
          Nächster<span aria-hidden="true">&nbsp;›</span>
        </Link>
      </nav>
    </>
  );

  if (!isManagerRole(membership.role)) {
    return (
      <Shell>
        {header}
        <Card>
          <p>Angebote prüfen können nur die Arbeitgeber*in und die Vertretung.</p>
        </Card>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: planningMonth, error: monthError } = await supabase
    .from("planning_months")
    .select("id, deadline, status, published_at")
    .eq("team_id", teamId)
    .eq("month", month)
    .maybeSingle();
  if (monthError) throw monthError;

  if (!planningMonth) {
    return (
      <Shell>
        {header}
        <Card className="flex flex-col gap-4">
          <p>Für {monthName} ist die Planung noch nicht geöffnet.</p>
          <OpenMonthButton teamId={teamId} month={month} />
        </Card>
      </Shell>
    );
  }

  const [{ data: needs, error: needsError }, { data: offerRows, error: offersError }] = await Promise.all([
    supabase.from("day_needs").select("date, hours").eq("planning_month_id", planningMonth.id),
    supabase
      .from("offers")
      .select("id, date, assistant_id, hours, size, note, status, is_late, decision_comment")
      .eq("planning_month_id", planningMonth.id)
      .in("status", ["submitted", "approved", "declined"]),
  ]);
  if (needsError) throw needsError;
  if (offersError) throw offersError;

  const assistantIds = [...new Set(offerRows.map((o) => o.assistant_id))];
  const { data: profiles, error: profilesError } = assistantIds.length
    ? await supabase.from("profiles").select("id, name").in("id", assistantIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;
  const names = new Map(profiles.map((p) => [p.id, p.name || "Ohne Namen"]));

  const offers: ApprovalOffer[] = offerRows.map((o) => ({
    id: o.id,
    date: o.date,
    assistantId: o.assistant_id,
    assistantName: names.get(o.assistant_id) ?? "Ohne Namen",
    hours: Number(o.hours ?? Number(o.size) * 24),
    size: Number(o.size),
    note: o.note,
    status: o.status,
    isLate: o.is_late,
    decisionComment: o.decision_comment,
  }));
  const days = buildApprovalDays(month, needs, offers);

  return (
    <Shell>
      {header}
      <ApprovalView
        teamId={teamId}
        planningMonth={planningMonth}
        days={days}
        onlyGaps={onlyGaps}
        filterHref={(gaps: boolean) => monthHref(month, gaps)}
        today={berlinToday()}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <PageShell>{children}</PageShell>
    </>
  );
}
