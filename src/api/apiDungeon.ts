// apiDungeon.ts
import { API_BASE } from "./base";
import type { GameSession, DungeonDetail } from "../types/dungeon";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export async function listDungeons(): Promise<
  Array<{ id?: string; name?: string }>
> {
  const u = new URL("dungeon/getAll", API_BASE);
  return http(u.toString());
}

export async function getDetail(dungeonId: string): Promise<DungeonDetail> {
  const u = new URL("dungeon/getById", API_BASE);
  u.searchParams.set("id", dungeonId);
  return http(u.toString());
}

/** Alltid ny session när reset=true. */
export async function startSession(
  playerId: string,
  dungeonId: string,
  reset = true
): Promise<GameSession> {
  const u = new URL("dungeon/session", API_BASE);
  u.searchParams.set("playerId", playerId);
  u.searchParams.set("dungeonId", dungeonId);
  if (reset) u.searchParams.set("reset", "1");
  const res = await fetch(u.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`POST ${u} -> ${res.status}`);
  return res.json() as Promise<GameSession>;
}

export async function move(
  playerId: string,
  dir: "N" | "E" | "S" | "W"
): Promise<GameSession> {
  const u = new URL("dungeon/move", API_BASE);
  u.searchParams.set("playerId", playerId);
  u.searchParams.set("dir", dir);
  return http(u.toString(), { method: "POST" });
}
