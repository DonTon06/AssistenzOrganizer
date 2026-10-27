"use server";

import { redirect } from "next/navigation";
import { checkPin, forgetAccount, getRememberedAccount, PIN_PATTERN, startSession } from "@/lib/pin-auth";
import { safeNextPath } from "@/lib/site-url";

// `at` changes on every failed try, so the form can clear the PIN field.
export type PinState = { error?: string; at?: number } | undefined;

const timeFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export async function signInWithPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const account = await getRememberedAccount();
  if (!account) return { error: "Bitte öffne deinen Einladungs- oder Zugangslink." };

  const pin = String(formData.get("pin") ?? "");
  if (!PIN_PATTERN.test(pin)) return { error: "Die PIN hat 6 Ziffern." };

  const check = await checkPin(account.id, pin);
  if (check.result === "locked") {
    const until = check.lockedUntil ? timeFormat.format(new Date(check.lockedUntil)) : "später";
    return { error: `Zu viele falsche Versuche. Du kannst es um ${until} Uhr wieder versuchen.`, at: Date.now() };
  }
  if (check.result !== "ok") {
    return { error: "Die PIN stimmt nicht. Bitte versuche es noch einmal.", at: Date.now() };
  }

  await startSession(account.id);
  redirect(safeNextPath(formData.get("weiter")) ?? "/");
}

export async function switchAccount() {
  await forgetAccount();
  redirect("/anmelden");
}
