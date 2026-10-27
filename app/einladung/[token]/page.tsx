import type { Metadata } from "next";
import Link from "next/link";
import { SetupNotice } from "@/components/setup-notice";
import { Card, PageShell } from "@/components/ui";
import { getUserId } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Team beitreten" };

// "Team beitreten": opened from an invite link, before anyone is signed in.
// Name, set PIN, done. An access link only asks for a new PIN.
export default async function JoinTeamPage({ params }: PageProps<"/einladung/[token]">) {
  if (!getSupabaseEnv()) return <SetupNotice />;

  const { token } = await params;
  const supabase = await createClient();
  const [{ data: invites }, signedInId] = await Promise.all([
    supabase.rpc("get_invite", { p_token: token }),
    getUserId(),
  ]);
  const invite = invites?.[0];

  if (!invite?.valid) {
    return (
      <PageShell>
        <h1 className="mb-6 text-3xl font-bold">Einladung</h1>
        <Card>
          <p className="mb-4 text-lg">
            Diese Einladung ist abgelaufen oder wurde schon benutzt. Bitte frag nach einem neuen Link.
          </p>
          <Link href="/anmelden" className="font-semibold text-brand underline">
            Zur Anmeldung
          </Link>
        </Card>
      </PageShell>
    );
  }

  const isAccessLink = invite.for_user_name !== null;
  const joinsWithExistingAccount = Boolean(signedInId) && !isAccessLink;

  let intro: React.ReactNode;
  if (isAccessLink) {
    intro = (
      <>
        Hallo <strong>{invite.for_user_name || "du"}</strong>, mit diesem Link meldest du dich auf
        diesem Gerät an und legst eine neue PIN fest.
      </>
    );
  } else if (invite.role === "employer") {
    intro = (
      <>
        Willkommen! Hier legst du dein Team „<strong>{invite.team_name}</strong>“ an. Danach lädst du
        deine Assistent*innen ein.
      </>
    );
  } else {
    intro = (
      <>
        {invite.employer_name || "Deine Arbeitgeberin oder dein Arbeitgeber"} lädt dich als{" "}
        {ROLE_LABELS[invite.role]} in das Team „<strong>{invite.team_name}</strong>“ ein.
      </>
    );
  }

  return (
    <PageShell>
      <h1 className="mb-6 text-3xl font-bold">{isAccessLink ? "Neu anmelden" : "Team beitreten"}</h1>
      <Card>
        <p className="mb-5 text-lg">{intro}</p>
        <JoinForm
          token={token}
          askForName={!isAccessLink}
          askForPin={!joinsWithExistingAccount}
          submitLabel={isAccessLink ? "PIN speichern und anmelden" : "Team beitreten"}
        />
      </Card>
    </PageShell>
  );
}
