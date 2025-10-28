// src/api/dungeon.ts
import { API_BASE, getJson } from "./base";
import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
} from "../types/dungeon";

// === URL helpers ===
function listUrl(): string {
  return new URL("dungeon/getAll", API_BASE).toString();
}

function getDetailUrl(dungeonId: string): string {
  const u = new URL("dungeon/getById", API_BASE);
  u.searchParams.set("id", dungeonId);
  return u.toString();
}

function startSessionUrl(playerId: string, dungeonId: string): string {
  const u = new URL("dungeon/session", API_BASE);
  u.searchParams.set("playerId", playerId);
  u.searchParams.set("dungeonId", dungeonId);
  return u.toString();
}

function moveUrl(playerId: string, dir: string): string {
  const u = new URL("dungeon/move", API_BASE);
  u.searchParams.set("playerId", playerId);
  u.searchParams.set("dir", dir);
  return u.toString();
}

// === API ===
export async function listDungeons(): Promise<DungeonSummary[]> {
  return getJson<DungeonSummary[]>(listUrl());
}

// NOTE: Din controller tar @RequestParam, inte body.
// POST utan body funkar fint här.
export async function startSession(
  playerId: string,
  dungeonId: string
): Promise<GameSession> {
  const url = startSessionUrl(playerId, dungeonId);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json() as Promise<GameSession>;
}

export async function getSession(
  playerId: string
): Promise<GameSession | null> {
  const u = new URL("dungeon/session", API_BASE);
  u.searchParams.set("playerId", playerId);
  const url = u.toString();

  const res = await fetch(url, { method: "GET" });
  if (res.status === 404) return null; // ← ingen session ännu
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return (await res.json()) as GameSession;
}

export async function getDetail(
  dungeonId: string
): Promise<DungeonDetail | null> {
  try {
    return await getJson<DungeonDetail>(getDetailUrl(dungeonId));
  } catch {
    return null;
  }
}

export async function move(
  playerId: string,
  dir: "N" | "E" | "S" | "W"
): Promise<GameSession> {
  const url = moveUrl(playerId, dir);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json() as Promise<GameSession>;
}

// INGET move-endpoint i din backend än. Lämnar bort tills vi lägger till det.
