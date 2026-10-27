"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/** Signs out. The device keeps the account, so next time only the PIN is asked. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/anmelden");
}

/**
 * Creates a single-use invite link. Managers (employer or proxy) invite
 * assistants and proxies; with forUserId it is an access link that lets an
 * existing member sign in on a new device or set a new PIN.
 */
export async function createInvite(
  teamId: string,
  role: "assistant" | "proxy",
  forUserId?: string,
): Promise<{ url?: string; error?: string }> {
  await requireManager(teamId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ team_id: teamId, role, for_user_id: forUserId ?? null })
    .select("token")
    .single();
  if (error) return { error: "Der Link konnte nicht erstellt werden." };

  return { url: `${await getSiteUrl()}/einladung/${data.token}` };
}
