import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
} from "../types/dungeon";
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

async function requestDungeon<T>(
  path: string,
  { params, init }: DungeonRequestOptions = {}
): Promise<T> {
  const url = buildDungeonUrl(dungeonBaseUrl, path, params);
  const response = await fetch(url.toString(), init);
  return handleJsonResponse<T>(response);
}

export async function getDungeonList(): Promise<DungeonSummary[]> {
  const list =
    await requestDungeon<DungeonSummary[] | null>("/getAll");
  return list ?? [];
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
