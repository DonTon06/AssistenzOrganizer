"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createAccount, deleteAccount, PIN_PATTERN, setPin, startSession } from "@/lib/pin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// `at` changes on every failed try, so the form can clear the PIN fields.
export type JoinState = { error?: string; at?: number } | undefined;

const fail = (error: string): JoinState => ({ error, at: Date.now() });

const EXPIRED = "Diese Einladung ist abgelaufen oder wurde schon benutzt. Bitte frag nach einem neuen Link.";

/**
 * Redeems an invite or access link: creates the account on a first invite,
 * joins the team, sets the PIN and signs in on this device.
 * Someone already signed in who opens an invite to another team just joins it.
 */
export async function redeemInvite(token: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("role, for_user_id, used_by, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite || invite.used_by || new Date(invite.expires_at) <= new Date()) {
    return fail(EXPIRED);
  }

  const signedInId = await getUserId();
  const joinsWithExistingAccount = Boolean(signedInId) && !invite.for_user_id;

  const name = String(formData.get("eigenerName") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");
  const pinRepeat = String(formData.get("pinWiederholung") ?? "");

  if (!invite.for_user_id && !name) {
    return fail("Bitte gib deinen Namen ein, damit dein Team dich erkennt.");
  }
  if (name.length > 100) return fail("Der Name darf höchstens 100 Zeichen lang sein.");
  if (!joinsWithExistingAccount) {
    if (!PIN_PATTERN.test(pin)) return fail("Die PIN muss aus 6 Ziffern bestehen.");
    if (pin !== pinRepeat) return fail("Die beiden PINs stimmen nicht überein.");
  }

  let userId = invite.for_user_id ?? signedInId;
  let createdNow = false;
  if (!userId) {
    userId = await createAccount(name);
    createdNow = true;
  }

  const { error } = await admin.rpc("redeem_invite", { p_token: token, p_user_id: userId });
  if (error) {
    if (createdNow) await deleteAccount(userId);
    return fail(EXPIRED);
  }

  if (name) await admin.from("profiles").update({ name }).eq("id", userId);
  if (!joinsWithExistingAccount) {
    await setPin(userId, pin);
    await startSession(userId);
  }

  redirect("/");
}
