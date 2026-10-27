"use client";

import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { createInvite } from "./actions";

/** Creates a single-use invite link and offers to share it (e.g. via WhatsApp). */
export function InviteButton({
  teamId,
  role,
  label,
}: {
  teamId: string;
  role: "assistant" | "proxy";
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  function create() {
    startTransition(async () => {
      const result = await createInvite(teamId, role);
      setUrl(result.url);
      setError(result.error);
      setCopied(false);
    });
  }

  async function share() {
    if (!url) return;
    const text = "Hier ist deine Einladung zum Assistenz-Planer:";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Einladung", text, url });
        return;
      } catch {
        // Cancelled or not allowed: fall back to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" onClick={create} disabled={pending}>
        {pending ? "Wird erstellt …" : label}
      </Button>
      {error ? <FormMessage error>{error}</FormMessage> : null}
      {url ? (
        <div className="flex flex-col gap-2">
          <p>Dieser Link gilt 14 Tage und für eine Person:</p>
          <p className="break-all rounded-lg bg-background p-3 font-mono text-sm">{url}</p>
          <Button type="button" onClick={share}>
            Link teilen
          </Button>
          {copied ? <FormMessage>Link kopiert.</FormMessage> : null}
        </div>
      ) : null}
    </div>
  );
}
