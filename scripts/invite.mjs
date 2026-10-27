// Operator tool: creates invite links that only the operator may make.
//
//   npm run einladung -- arbeitgeber "Team Erika"   link for a new employer, who creates the team
//   npm run einladung -- zugang <user-id>           new access link for an existing member
//                                                   (new phone or forgotten PIN; works for employers too)
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SITE_URL
// from the environment or .env.local.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY fehlen (siehe README).");
  process.exit(1);
}

const [mode, arg] = process.argv.slice(2);

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`);
  return body;
}

let invite;
if (mode === "arbeitgeber" && arg) {
  [invite] = await rest("invites", {
    method: "POST",
    body: JSON.stringify({ role: "employer", team_name: arg }),
  });
} else if (mode === "zugang" && arg) {
  const [membership] = await rest(
    `memberships?user_id=eq.${encodeURIComponent(arg)}&active=eq.true&select=team_id,role&order=created_at&limit=1`,
    { method: "GET" },
  );
  if (!membership) throw new Error("Diese Person ist in keinem aktiven Team.");
  [invite] = await rest("invites", {
    method: "POST",
    body: JSON.stringify({ team_id: membership.team_id, role: membership.role, for_user_id: arg }),
  });
} else {
  console.error('Aufruf: npm run einladung -- arbeitgeber "Teamname"  |  npm run einladung -- zugang <user-id>');
  process.exit(1);
}

console.log(`${site}/einladung/${invite.token}`);
console.log(`Gültig bis ${new Date(invite.expires_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}, nur einmal nutzbar.`);
