import type { Player } from "../../types/player";

const playersListUrl = new URL(
  "players/getAllPlayers",
  import.meta.env.VITE_API_URL
).toString();

const createPlayerUrl = new URL(
  "players/createPlayer",
  import.meta.env.VITE_API_URL
).toString();

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
