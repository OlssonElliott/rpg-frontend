import { getJson, postJson } from "./base";
import type { Player } from "../types/player";
import { buildApiUrl } from "../utils/api";

const playersListUrl = buildApiUrl("players/getAllPlayers");
const createPlayerUrl = buildApiUrl("players/createPlayer");

export async function fetchAllPlayers(): Promise<Player[]> {
  return getJson<Player[]>(playersListUrl);
}

export async function createPlayer(name: string): Promise<Player> {
  return postJson<Player>(createPlayerUrl, { name });
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const u = new URL(buildApiUrl("players/getPlayerById"));
  u.searchParams.set("id", id);
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as Player;
}
