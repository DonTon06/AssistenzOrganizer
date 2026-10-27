import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Sign-in works without passwords or email: the first sign-in is by invite
// link, after that a 6-digit PIN. The PIN is checked in the database (bcrypt,
// with a lockout after 5 wrong tries); on success the server mints a Supabase
// session for that user. Auth accounts get a placeholder email that never
// receives mail; contact details live in the profile.

const ACCOUNT_COOKIE = "ao_konto";
const PLACEHOLDER_EMAIL_DOMAIN = "konto.assistenz-planer.invalid";

export const PIN_PATTERN = /^[0-9]{6}$/;

/** The account last used on this device, so the sign-in screen only asks for the PIN. */
export async function getRememberedAccount(): Promise<{ id: string; name: string } | null> {
  const id = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, name").eq("id", id).maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

export async function forgetAccount() {
  (await cookies()).delete(ACCOUNT_COOKIE);
}

async function rememberAccount(userId: string) {
  (await cookies()).set(ACCOUNT_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
    path: "/",
  });
}

/** Creates an auth account for someone redeeming their first invite. */
export async function createAccount(name: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw error ?? new Error("Konto konnte nicht angelegt werden.");
  return data.user.id;
}

export async function deleteAccount(userId: string) {
  await createAdminClient().auth.admin.deleteUser(userId);
}

export async function setPin(userId: string, pin: string) {
  const { error } = await createAdminClient().rpc("set_pin", { p_user_id: userId, p_pin: pin });
  if (error) throw error;
}

export type PinCheck = { result: "ok" | "wrong" | "locked" | "no_pin"; lockedUntil: string | null };

export async function checkPin(userId: string, pin: string): Promise<PinCheck> {
  const { data, error } = await createAdminClient().rpc("check_pin", { p_user_id: userId, p_pin: pin });
  if (error || !data?.[0]) throw error ?? new Error("PIN-Prüfung fehlgeschlagen.");
  return { result: data[0].result as PinCheck["result"], lockedUntil: data[0].locked_until };
}

/** Starts a Supabase session for the user in this browser and remembers the account. */
export async function startSession(userId: string) {
  const admin = createAdminClient();
  const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !user.user?.email) throw userError ?? new Error("Konto nicht gefunden.");

  // A one-time login token that is never emailed: it is redeemed right here.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.user.email,
  });
  if (linkError) throw linkError;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (error) throw error;

  await rememberAccount(userId);
}
