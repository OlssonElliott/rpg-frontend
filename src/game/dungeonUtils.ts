import type { DungeonRoomNode } from "../types/dungeon";

export const dungeonBaseUrl = new URL(
  "./dungeon",
  import.meta.env.VITE_API_URL
).toString();

export const dungeonDirections = [
  { value: "N", label: "Norr" },
  { value: "E", label: "Öst" },
  { value: "S", label: "Syd" },
  { value: "W", label: "Väst" },
] as const;

export type DungeonDirection =
  (typeof dungeonDirections)[number]["value"];

export function isDungeonDirection(
  value: string
): value is DungeonDirection {
  return dungeonDirections.some((direction) => direction.value === value);
}

export function dungeonTimestamp(): string {
  return new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function buildDungeonUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | null | undefined>
): URL {
  try {
    const url = new URL(baseUrl);
    const trimmedPath = path.startsWith("/") ? path : `/${path}`;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${trimmedPath}`;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null && value !== "") {
          url.searchParams.set(key, value);
        }
      });
    }
    return url;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to build dungeon URL for path "${path}": ${reason}`
    );
  }
}

export function resolveDungeonWsUrl(httpUrl: string): string {
  try {
    const url = new URL(httpUrl);
    url.pathname = "/ws-combat";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function describeRoom(room: DungeonRoomNode | null): string {
  if (!room) {
    return "Okänt rum";
  }
  const tags: string[] = [];
  if (room.start) tags.push("start");
  if (room.cleared) tags.push("rensad");
  return tags.length > 0
    ? `${room.roomId} (${tags.join(", ")})`
    : room.roomId;
}
