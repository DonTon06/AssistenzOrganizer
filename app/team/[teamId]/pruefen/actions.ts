"use server";

import { refresh } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Decisions on offers. Row-level security and the offers trigger enforce who
// may decide; requireManager only gives a clear error early. The trigger
// stamps decided_by and decided_at.

type Result = { error?: string };

/** Approves or declines one offer, with an optional comment for the assistant. */
export async function decideOffer(
  teamId: string,
  offerId: string,
  decision: "approved" | "declined",
  comment: string,
): Promise<Result> {
  await requireManager(teamId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .update({ status: decision, decision_comment: comment.trim().slice(0, 500) || null })
    .eq("id", offerId)
    .eq("team_id", teamId)
    .in("status", ["submitted", "approved", "declined"])
    .select("id");
  if (error) return { error: "Die Entscheidung konnte nicht gespeichert werden." };
  if (!data.length) return { error: "Das Angebot wurde inzwischen zurückgezogen." };
  refresh();
  return {};
}

/** "Alle bestätigen": approves every open offer of the month, late ones included. */
export async function approveAll(teamId: string, planningMonthId: string): Promise<Result> {
  await requireManager(teamId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update({ status: "approved" })
    .eq("team_id", teamId)
    .eq("planning_month_id", planningMonthId)
    .eq("status", "submitted");
  if (error) return { error: "Die Angebote konnten nicht bestätigt werden." };
  refresh();
  return {};
}

/**
 * Publishes the schedule: assistants then see everyone's approved shifts.
 * Decisions can still be changed afterwards.
 */
export async function publishMonth(teamId: string, planningMonthId: string): Promise<Result> {
  await requireManager(teamId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("planning_months")
    .update({ status: "published" })
    .eq("id", planningMonthId)
    .eq("team_id", teamId);
  if (error) return { error: "Der Dienstplan konnte nicht veröffentlicht werden." };
  refresh();
  return {};
}

/** Opens planning for a month that has none yet. */
export async function openMonth(teamId: string, month: string): Promise<Result> {
  await requireManager(teamId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_planning_month", { p_team_id: teamId, p_month: month });
  if (error) return { error: "Der Monat konnte nicht geöffnet werden." };
  refresh();
  return {};
}
