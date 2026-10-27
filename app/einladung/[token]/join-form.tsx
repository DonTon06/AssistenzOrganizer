"use client";

import { useActionState, useState } from "react";
import { PinInput } from "@/components/pin-input";
import { Button, FormMessage, TextField } from "@/components/ui";
import { redeemInvite } from "./actions";

export function JoinForm({
  token,
  askForName,
  askForPin,
  submitLabel,
}: {
  token: string;
  askForName: boolean;
  askForPin: boolean;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(redeemInvite.bind(null, token), undefined);
  // Controlled, so the name survives a failed try.
  const [name, setName] = useState("");

  return (
    <form action={action} className="flex flex-col gap-5">
      {askForName ? (
        <TextField
          id="eigenerName"
          name="eigenerName"
          label="Dein Name"
          hint="So sieht dich dein Team im Dienstplan."
          autoComplete="name"
          maxLength={100}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : null}
      {askForPin ? (
        <>
          <p>Wähle eine 6-stellige PIN. Damit meldest du dich künftig an.</p>
          <PinInput key={`pin-${state?.at}`} id="pin" name="pin" label="Neue PIN" autoComplete="new-password" />
          <PinInput
            key={`wdh-${state?.at}`}
            id="pinWiederholung"
            name="pinWiederholung"
            label="PIN wiederholen"
            autoComplete="new-password"
          />
        </>
      ) : null}
      {state?.error ? <FormMessage error>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Einen Moment …" : submitLabel}
      </Button>
    </form>
  );
}
