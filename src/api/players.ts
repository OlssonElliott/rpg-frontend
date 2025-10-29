import { API_BASE, getJson, postJson } from "./base";
import type { Player } from "../types/player";

const playersListUrl = new URL("players/getAllPlayers", API_BASE).toString();
const createPlayerUrl = new URL("players/createPlayer", API_BASE).toString();

export async function fetchAllPlayers(): Promise<Player[]> {
  return getJson<Player[]>(playersListUrl);
}

export async function createPlayer(name: string): Promise<Player> {
  return postJson<Player>(createPlayerUrl, { name });
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const u = new URL("players/getPlayerById", API_BASE);
  u.searchParams.set("id", id);
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Player;
}
