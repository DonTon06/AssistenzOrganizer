import type { Metadata } from "next";
import { SetupNotice } from "@/components/setup-notice";
import { Card, PageShell } from "@/components/ui";
import { getRememberedAccount } from "@/lib/pin-auth";
import { safeNextPath } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { switchAccount } from "./actions";
import { PinForm } from "./pin-form";

export const metadata: Metadata = { title: "Anmelden" };

// "Anmelden": PIN entry for the account last used on this device. New people
// and new devices come in through an invite or access link instead.
export default async function SignInPage({ searchParams }: PageProps<"/anmelden">) {
  if (!getSupabaseEnv()) return <SetupNotice />;

  const params = await searchParams;
  const next = safeNextPath(params.weiter) ?? undefined;
  const account = await getRememberedAccount();

  return (
    <PageShell>
      <h1 className="mb-6 text-3xl font-bold">Anmelden</h1>
      {account ? (
        <Card>
          <p className="mb-4 text-lg">
            Hallo <strong>{account.name || "du"}</strong>, gib deine PIN ein.
          </p>
          <PinForm next={next} />
          <form action={switchAccount} className="mt-4">
            <button type="submit" className="min-h-12 font-semibold text-brand underline">
              Nicht {account.name || "du"}? Anderes Konto
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-2 text-xl font-semibold">So kommst du hinein</h2>
          <p className="mb-3">
            Öffne den Einladungslink, den du per WhatsApp oder E-Mail bekommen hast. Dort legst du
            deine PIN fest.
          </p>
          <p>
            Neues Handy oder PIN vergessen? Bitte deine Arbeitgeberin, deinen Arbeitgeber oder die
            Vertretung um einen neuen Zugangslink.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
