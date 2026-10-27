import { Card, PageShell } from "@/components/ui";

/** Shown while no Supabase project is connected. */
export function SetupNotice() {
  return (
    <PageShell>
      <h1 className="mb-4 text-2xl font-bold">Assistenz-Planer</h1>
      <Card>
        <h2 className="mb-2 text-xl font-semibold">Noch nicht eingerichtet</h2>
        <p>
          Die App ist noch mit keinem Supabase-Projekt verbunden. Lege die Werte{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> und <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          in <code>.env.local</code> an. Die Schritte stehen in der README.
        </p>
      </Card>
    </PageShell>
  );
}
