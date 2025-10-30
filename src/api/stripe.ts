import { API_BASE } from "./base";

export async function createCheckout(playerId: string): Promise<string> {
  const u = new URL("billing/checkout", API_BASE);
  u.searchParams.set("playerId", playerId);
  const r = await fetch(u.toString(), { method: "POST" });
  if (!r.ok) throw new Error(`checkout ${r.status}`);
  const { url } = await r.json();
  return url as string;
}

export async function verifyCheckout(
  sessionId: string
): Promise<{ ok: boolean; armor?: number; alreadyApplied?: boolean }> {
  const u = new URL("billing/verify", API_BASE);
  u.searchParams.set("sessionId", sessionId);
  const r = await fetch(u.toString(), { method: "POST" });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}
