import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
  RoomTemplate,
} from "../types/dungeon";
import type { Combat } from "../types/combat";
import { buildDungeonUrl, dungeonBaseUrl } from "./dungeonUtils";

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = `Request failed (${response.status})`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

type DungeonRequestOptions = {
  params?: Record<string, string | null | undefined>;
  init?: RequestInit;
};

const roomBaseUrl = new URL(
  "./rooms",
  import.meta.env.VITE_API_URL
).toString();

const combatBaseUrl = new URL(
  "./combat",
  import.meta.env.VITE_API_URL
).toString();

async function requestApi<T>(
  baseUrl: string,
  path: string,
  { params, init }: DungeonRequestOptions = {}
): Promise<T> {
  const url = buildDungeonUrl(baseUrl, path, params);
  const response = await fetch(url.toString(), init);
  return handleJsonResponse<T>(response);
}

async function requestDungeon<T>(
  path: string,
  options?: DungeonRequestOptions
): Promise<T> {
  return await requestApi<T>(dungeonBaseUrl, path, options);
}

export async function getDungeonList(
  playerId?: string
): Promise<DungeonSummary[]> {
  const params: Record<string, string> = {};
  const trimmedPlayerId = playerId?.trim();
  if (trimmedPlayerId) {
    params.playerId = trimmedPlayerId;
  }
  const list = await requestDungeon<DungeonSummary[] | null>("/getAll", {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return list ?? [];
}

export async function createDungeon(
  playerId: string
): Promise<DungeonSummary | null> {
  const trimmed = playerId.trim();
  if (!trimmed) {
    throw new Error("Player id is required to create a dungeon.");
  }

  return await requestDungeon<DungeonSummary | null>("/create", {
    params: { playerId: trimmed },
    init: { method: "POST" },
  });
}

export async function getDungeonDetail(
  id: string
): Promise<DungeonDetail | null> {
  return await requestDungeon<DungeonDetail | null>("/getById", {
    params: { id },
  });
}

export async function getDungeonSession(
  playerId: string
): Promise<GameSession | null> {
  return await requestDungeon<GameSession | null>("/session", {
    params: { playerId },
  });
}

export async function postDungeonSession(
  playerId: string,
  dungeonId: string
): Promise<GameSession | null> {
  return await requestDungeon<GameSession | null>("/session", {
    params: { playerId, dungeonId },
    init: { method: "POST" },
  });
}

export async function getRoomTemplate(
  roomRefId: string
): Promise<RoomTemplate | null> {
  if (!roomRefId) {
    return null;
  }
  return await requestApi<RoomTemplate | null>(roomBaseUrl, "/getById", {
    params: { id: roomRefId },
  });
}

export async function getCombatState(
  combatId: string
): Promise<Combat | null> {
  if (!combatId) {
    return null;
  }
  return await requestApi<Combat | null>(combatBaseUrl, `/${combatId}`);
}
