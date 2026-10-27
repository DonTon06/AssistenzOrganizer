import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { SetupNotice } from "@/components/setup-notice";
import { Card, PageShell } from "@/components/ui";
import { getMemberships, isManagerRole, requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { InviteButton } from "./invite-button";

// Start screen. Shows the caller's teams and roles, and links managers to the
// approval screen. The month overview, offers and swaps get their own screens.
export default async function StartPage() {
  if (!getSupabaseEnv()) return <SetupNotice />;

  const user = await requireUser();
  const supabase = await createClient();
  const [memberships, { data: profile }] = await Promise.all([
    getMemberships(user.id),
    supabase.from("profiles").select("name").eq("id", user.id).single(),
  ]);

  return (
    <>
      <AppHeader />
      <PageShell>
        <h1 className="mb-6 text-3xl font-bold">
          {profile?.name ? `Hallo ${profile.name}` : "Start"}
        </h1>

        {memberships.length === 0 ? (
          <Card>
            <p>
              Du bist gerade in keinem Team. Bitte frag nach einem neuen Einladungslink.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Deine Teams">
            {memberships.map((m) => (
              <li key={m.teamId}>
                <Card>
                  <h2 className="text-xl font-semibold">{m.teamName}</h2>
                  <p className="mb-4 text-muted">Deine Rolle: {ROLE_LABELS[m.role]}</p>
                  {isManagerRole(m.role) ? (
                    <div className="flex flex-col gap-3">
                      <Link
                        href={`/team/${m.teamId}/pruefen`}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-brand-foreground"
                      >
                        Angebote prüfen
                      </Link>
                      <InviteButton teamId={m.teamId} role="assistant" label="Assistent*in einladen" />
                      <InviteButton teamId={m.teamId} role="proxy" label="Vertretung einladen" />
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </>
  );
}
