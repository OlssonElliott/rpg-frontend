import { useCallback, useRef, useState } from "react";
import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
} from "../../types/dungeon";
import {
  createDungeon,
  getDungeonDetail,
  getDungeonList,
  getDungeonSession,
  postDungeonSession,
} from "../dungeonApi";
import type { DungeonDirection } from "../dungeonUtils";
import type { DungeonLoadingState } from "./useDungeonLoading";

type UseDungeonActionsArgs = {
  normalizedPlayerId: string;
  selectedDungeonId: string;
  appendLog: (message: string) => void;
  applySessionUpdate: (next: GameSession | null, logPrefix?: string) => void;
  withLoading: <T>(
    key: keyof DungeonLoadingState,
    task: () => Promise<T>
  ) => Promise<T>;
  setDungeons: React.Dispatch<React.SetStateAction<DungeonSummary[]>>;
  setDungeonDetail: React.Dispatch<React.SetStateAction<DungeonDetail | null>>;
  setSelectedDungeonId: (value: string) => void;
  requestSync: () => boolean;
  sendMove: (direction: DungeonDirection) => boolean;
};

type UseDungeonActionsResult = {
  mapLoading: boolean;
  reloadDungeons: () => Promise<void>;
  loadDetail: (id: string, showSpinner?: boolean) => Promise<void>;
  syncSession: () => Promise<void>;
  startOrResume: () => Promise<void>;
  loadSelectedDungeon: (showSpinner?: boolean) => Promise<void>;
  move: (direction: DungeonDirection) => void;
};

export function useDungeonActions({
  normalizedPlayerId,
  selectedDungeonId,
  appendLog,
  applySessionUpdate,
  withLoading,
  setDungeons,
  setDungeonDetail,
  setSelectedDungeonId,
  requestSync,
  sendMove,
}: UseDungeonActionsArgs): UseDungeonActionsResult {
  const [mapLoading, setMapLoading] = useState(false);
  const pendingDetailIdRef = useRef<string>("");

  const reloadDungeons = useCallback(async () => {
    try {
      await withLoading("list", async () => {
        let list = await getDungeonList(normalizedPlayerId);
        if (list.length === 0) {
          if (!normalizedPlayerId) {
            appendLog(
              "Inga dungeons hittades och ingen spelare vald - v\u00E4lj en karakt\u00E4r f\u00F6r att skapa en automatisk dungeon."
            );
          } else {
            appendLog(
              "Inga dungeons hittades - f\u00F6rs\u00F6ker skapa en ny automatiskt."
            );
            try {
              const created = await createDungeon(normalizedPlayerId);
              if (created?.id) {
                const label = created.name ?? created.id;
                appendLog(`Dungeon ${label} skapad automatiskt.`);
                list = await getDungeonList(normalizedPlayerId);
              } else {
                appendLog(
                  "Automatisk dungeon-skapning returnerade inget resultat."
                );
              }
            } catch (error: unknown) {
              appendLog(
                `Fel vid automatisk dungeon-skapning: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        }
        setDungeons(list);
        appendLog(`Dungeonlista h\u00E4mtad (${list.length} st).`);
      });
    } catch (error: unknown) {
      appendLog(
        `Fel vid dungeonlista: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [appendLog, normalizedPlayerId, setDungeons, withLoading]);

  const loadDetail = useCallback(
    async (id: string, showSpinner = false) => {
      const trimmed = id.trim();
      pendingDetailIdRef.current = trimmed;

      if (!trimmed) {
        setDungeonDetail(null);
        return;
      }

      if (showSpinner) {
        setMapLoading(true);
      }

      try {
        const detail = await getDungeonDetail(trimmed);
        if (pendingDetailIdRef.current !== trimmed) {
          return;
        }

        setDungeonDetail(detail);
        if (detail) {
          appendLog(
            `Dungeon ${detail.name ?? detail.id ?? trimmed} laddad (${
              detail.rooms?.length ?? 0
            } rum).`
          );
        }
      } catch (error) {
        if (pendingDetailIdRef.current === trimmed) {
          appendLog(
            `Fel vid dungeon-detalj: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } finally {
        if (showSpinner && pendingDetailIdRef.current === trimmed) {
          setMapLoading(false);
        }
      }
    },
    [appendLog, setDungeonDetail, setMapLoading]
  );

  const syncSession = useCallback(async () => {
    if (!normalizedPlayerId) {
      appendLog("Välj karaktär innan session hämtas.");
      return;
    }

    const synced = requestSync();
    if (synced) {
      appendLog("Begärde session-sync via websocket.");
      return;
    }

    try {
      await withLoading("sync", async () => {
        const next = await getDungeonSession(normalizedPlayerId);
        if (!next) {
          appendLog("Ingen session hittades.");
          return;
        }
        applySessionUpdate(next, "Synk");
        appendLog("Session uppdaterad via REST.");
      });
    } catch (error: unknown) {
      appendLog(
        `Fel vid session-h\u00E4mtning: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [
    appendLog,
    applySessionUpdate,
    normalizedPlayerId,
    requestSync,
    withLoading,
  ]);

  const startOrResume = useCallback(async () => {
    if (!normalizedPlayerId) {
      appendLog("Välj karaktär först.");
      return;
    }

    let dungeonId = selectedDungeonId.trim();

    if (!dungeonId) {
      appendLog("Skapar en ny dungeon för den här karaktären...");
      try {
        const created = await createDungeon(normalizedPlayerId);
        if (!created?.id) {
          appendLog("Kunde inte skapa en ny dungeon automatiskt.");
          return;
        }
        const trimmedId = created.id.trim();
        setDungeons((previous) => {
          const filtered = previous.filter(
            (candidate) => candidate.id?.trim() !== trimmedId
          );
          return [created, ...filtered];
        });
        setSelectedDungeonId(trimmedId);
        dungeonId = trimmedId;
      } catch (error: unknown) {
        appendLog(
          `Fel vid automatisk dungeon-skapning: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return;
      }
    }

    try {
      await withLoading("session", async () => {
        const next = await postDungeonSession(normalizedPlayerId, dungeonId);
        if (!next) {
          appendLog("Session POST returnerade inget innehåll.");
          return;
        }
        appendLog("Session skapad/återupptagen.");
        applySessionUpdate(next, "Start");

        const synced = requestSync();
        appendLog(
          synced
            ? "Synk via websocket begärd."
            : "Synk via REST (websocket ej ansluten)."
        );
      });
    } catch (error: unknown) {
      appendLog(
        `Fel vid session-skapande: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [
    appendLog,
    applySessionUpdate,
    normalizedPlayerId,
    requestSync,
    selectedDungeonId,
    setDungeons,
    setSelectedDungeonId,
    withLoading,
  ]);

  const loadSelectedDungeon = useCallback(
    async (showSpinner = false) => {
      if (!selectedDungeonId) return;
      await loadDetail(selectedDungeonId, showSpinner);
    },
    [loadDetail, selectedDungeonId]
  );

  const move = useCallback(
    (direction: DungeonDirection) => {
      if (!normalizedPlayerId) {
        appendLog("Välj karaktär innan du flyttar.");
        return;
      }
      const published = sendMove(direction);
      appendLog(
        published
          ? `Förflyttning skickad (${direction}).`
          : "Websocket ej ansluten."
      );
    },
    [appendLog, normalizedPlayerId, sendMove]
  );

  return {
    mapLoading,
    reloadDungeons,
    loadDetail,
    syncSession,
    startOrResume,
    loadSelectedDungeon,
    move,
  };
}
