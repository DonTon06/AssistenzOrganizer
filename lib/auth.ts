import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/lib/roles";

export type Membership = {
  teamId: string;
  teamName: string;
  role: TeamRole;
};

/** The signed-in user, or a redirect to the sign-in page. */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/anmelden");
  return { id: data.claims.sub };
}

/** The signed-in user's id, or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/** The caller's active teams and their role in each. Assistants can be in several. */
export async function getMemberships(userId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, teams(id, name)")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at");
  if (error) throw error;

  return data.flatMap((m) =>
    m.teams ? [{ teamId: m.teams.id, teamName: m.teams.name, role: m.role }] : [],
  );
}

/** Throws unless the caller is the team's employer or proxy. RLS enforces this too. */
export async function requireManager(teamId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_team_manager", { p_team_id: teamId });
  if (error || !data) throw new Error("Nur Arbeitgeber*in oder Vertretung dürfen das.");
  return user;
}

export function isManagerRole(role: TeamRole) {
  return role === "employer" || role === "proxy";
}
