"use client";

import { useActionState } from "react";
import { PinInput } from "@/components/pin-input";
import { Button, FormMessage } from "@/components/ui";
import { signInWithPin } from "./actions";

export function PinForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInWithPin, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="weiter" value={next} /> : null}
      <PinInput key={state?.at} id="pin" name="pin" label="Deine PIN" invalid={Boolean(state?.error)} autoFocus />
      {state?.error ? <FormMessage error>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Wird geprüft …" : "Anmelden"}
      </Button>
    </form>
  );
}
