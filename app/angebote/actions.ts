"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formatDayShort } from "@/lib/dates";
import { OFFER_SIZES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { OfferChange } from "./types";

const SIZES = new Set<number>(OFFER_SIZES.map((s) => s.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHANGES = 62;

export type SaveOffersResult = { saved: number; errors: string[] };

/**
 * Saves the assistant's offers for one planning month: new days, changed
 * sizes or notes, and withdrawn offers. Row-level security and the offers
 * trigger decide what is allowed; the trigger also marks late offers.
 */
export async function saveOffers(
  teamId: string,
  planningMonthId: string,
  changes: OfferChange[],
): Promise<SaveOffersResult> {
  const user = await requireUser();
  const supabase = await createClient();

  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) {
    return { saved: 0, errors: ["Die Änderungen konnten nicht gelesen werden."] };
  }

  let saved = 0;
  const errors: string[] = [];

  for (const change of changes) {
    if (!isValid(change)) {
      errors.push("Eine Änderung war ungültig und wurde übersprungen.");
      continue;
    }

    const note = "note" in change ? change.note.trim() || null : null;
    const { error } =
      change.kind === "add"
        ? await supabase.from("offers").insert({
            team_id: teamId,
            planning_month_id: planningMonthId,
            assistant_id: user.id,
            date: change.date,
            size: change.size,
            note,
          })
        : change.kind === "update"
          ? await supabase
              .from("offers")
              .update({ size: change.size, note })
              .eq("id", change.offerId)
              .eq("status", "submitted")
          : await supabase
              .from("offers")
              .update({ status: "withdrawn" })
              .eq("id", change.offerId)
              .eq("status", "submitted");

    if (error) {
      errors.push(`${formatDayShort(change.date)}: ${explain(error)}`);
    } else {
      saved++;
    }
  }

  refresh();
  return { saved, errors };
}

function isValid(change: OfferChange): boolean {
  if (!change || typeof change !== "object" || !ISO_DATE.test(change.date)) return false;
  if (change.kind === "withdraw") return typeof change.offerId === "string";
  if (!SIZES.has(change.size) || typeof change.note !== "string" || change.note.length > 500) {
    return false;
  }
  return change.kind === "add" || (change.kind === "update" && typeof change.offerId === "string");
}

function explain(error: { code?: string; message: string }): string {
  // Unique index: one live offer per assistant and day.
  if (error.code === "23505") return "Für diesen Tag hast du schon ein Angebot.";
  // Postgres' own messages (RLS, check constraints) are English.
  if (error.message.includes("violates")) return "Keine Berechtigung oder ungültige Angabe.";
  // Messages raised by the database triggers are already in German.
  if (error.code === "42501" || error.code === "23514") return error.message;
  return "Konnte nicht gespeichert werden.";
}
