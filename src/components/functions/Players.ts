import type { Player } from "../../types/player";
import { buildApiUrl } from "../../utils/api";

const playersListUrl = buildApiUrl("players/getAllPlayers");
const createPlayerUrl = buildApiUrl("players/createPlayer");

export async function fetchAllPlayers(): Promise<Player[]> {
  try {
    const response = await fetch(playersListUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Kunde ej hämta players");
    }

    return (await response.json()) as Player[];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function createPlayer(name: string): Promise<Player | null> {
  try {
    const response = await fetch(createPlayerUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Kunde ej skapa player");
    }

    return (await response.json()) as Player;
  } catch (err) {
    console.error(err);
    return null;
  }
}
