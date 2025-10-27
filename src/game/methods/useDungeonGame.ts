import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPlayerKey, usePlayersContext } from "../../context/PlayersContext";
import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
  RoomTemplate,
} from "../../types/dungeon";
import type { Combat } from "../../types/combat";
import {
  describeRoom,
  isDungeonDirection,
  type DungeonDirection,
} from "../dungeonUtils";
import { useDungeonLog, type DungeonLogEntry } from "./useDungeonLog";
import { useDungeonSocket } from "./useDungeonSocket";
import {
  useDungeonLoading,
  type DungeonLoadingState,
} from "./useDungeonLoading";
import { useAutoSelectDungeon } from "./useAutoSelectDungeon";
import { useCombatRefresh } from "./useCombatRefresh";
import { useDungeonActions } from "./useDungeonActions";
import { createDungeon, getRoomTemplate, postDungeonSession } from "../dungeonApi";
import { useCombatChannel } from "./useCombatChannel";

type DungeonActions = {
  reloadDungeons: () => Promise<void>;
  startOrResume: () => Promise<void>;
  syncSession: () => Promise<void>;
  loadSelectedDungeon: (showSpinner?: boolean) => Promise<void>;
  move: (direction: DungeonDirection) => void;
  refreshCombat: () => Promise<void>;
  attackEnemy: (enemyIndex?: number | null) => Promise<void>;
  selectCombatTarget: (index: number | null) => void;
};

export type DungeonGameState = {
  selectedPlayerName: string | null;
  normalizedPlayerId: string;
  dungeons: DungeonSummary[];
  selectedDungeonId: string;
  setSelectedDungeonId: (value: string) => void;
  dungeonDetail: DungeonDetail | null;
  session: GameSession | null;
  currentRoomLabel: string;
  currentRoomTemplate: RoomTemplate | null;
  availableDirections: DungeonDirection[];
  combatActive: boolean;
  combat: Combat | null;
  wsConnected: boolean;
  combatWsConnected: boolean;
  loading: boolean;
  loadingState: DungeonLoadingState;
  mapLoading: boolean;
  log: DungeonLogEntry[];
  selectedCombatTarget: number | null;
  actions: DungeonActions;
};

export function useDungeonGame(): DungeonGameState {
  const { selectedPlayer, refreshPlayers, upsertPlayer } = usePlayersContext();
  const normalizedPlayerId = selectedPlayer
    ? getPlayerKey(selectedPlayer).trim()
    : "";
  const selectedPlayerName = selectedPlayer?.name ?? null;

  const [dungeons, setDungeons] = useState<DungeonSummary[]>([]);
  const [selectedDungeonId, setSelectedDungeonId] = useState("");
  const [dungeonDetail, setDungeonDetail] = useState<DungeonDetail | null>(
    null
  );
  const [session, setSession] = useState<GameSession | null>(null);
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(true);
  const [roomTemplates, setRoomTemplates] = useState<
    Map<string, RoomTemplate>
  >(() => new Map());
  const [currentRoomTemplate, setCurrentRoomTemplate] =
    useState<RoomTemplate | null>(null);
  const playerDefeatHandledRef = useRef(false);
  const dungeonClearedHandledRef = useRef(false);
  const previousPlayerIdRef = useRef<string>("");
  const selectedDungeonOwnerRef = useRef<string | null>(null);
  const playerSelectedDungeonRef = useRef<Map<string, string>>(new Map());

  const setSelectedDungeonIdForPlayer = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        setSelectedDungeonId("");
        if (
          normalizedPlayerId &&
          selectedDungeonOwnerRef.current === normalizedPlayerId
        ) {
          selectedDungeonOwnerRef.current = null;
          playerSelectedDungeonRef.current.delete(normalizedPlayerId);
        }
        return;
      }

      if (!normalizedPlayerId) {
        setSelectedDungeonId(trimmed);
        return;
      }

      const existingOwner = dungeonOwnersRef.current.get(trimmed);
      if (existingOwner && existingOwner !== normalizedPlayerId) {
        return;
      }

      dungeonOwnersRef.current.set(trimmed, normalizedPlayerId);
      playerSelectedDungeonRef.current.set(normalizedPlayerId, trimmed);
      selectedDungeonOwnerRef.current = normalizedPlayerId;
      setSelectedDungeonId(trimmed);
    },
    [normalizedPlayerId]
  );
  const dungeonOwnersRef = useRef<Map<string, string>>(new Map());

  const {
    entries: log,
    append: appendLog,
    reset: resetLog,
  } = useDungeonLog("Dungeon redo.");
  const { loadingState, loading, withLoading } = useDungeonLoading();

  const applySessionUpdate = useCallback(
    (next: GameSession | null) => {
      if (!next) {
        return;
      }

      setSession((previous) => {
        if (next.dungeonId && next.dungeonId !== selectedDungeonId) {
          setSelectedDungeonIdForPlayer(next.dungeonId);
        }

        if (
          next.currentCombatId &&
          next.currentCombatId !== previous?.currentCombatId
        ) {
          appendLog(`Strid startad (id: ${next.currentCombatId}).`);
        }

        if (previous?.currentCombatId && !next.currentCombatId) {
          appendLog("Strid avslutad.");
        }

        return next;
      });
    },
    [appendLog, selectedDungeonId, setSelectedDungeonIdForPlayer]
  );

const handlePlayerCleared = useCallback(() => {
    setSession(null);
    setDungeonDetail(null);
    setSelectedDungeonIdForPlayer("");
    setAutoSelectEnabled(true);
    setDungeons([]);
    playerDefeatHandledRef.current = false;
    dungeonClearedHandledRef.current = false;
    resetLog("V\u00E4lj en karakt\u00E4r f\u00F6r att b\u00F6rja.");
  }, [resetLog, setDungeons, setSelectedDungeonIdForPlayer]);

  // Socket
  const {
    connected: wsConnected,
    requestSync,
    sendMove,
  } = useDungeonSocket({
    playerId: normalizedPlayerId,
    onSessionMessage: (payload) => {
      applySessionUpdate(payload);
    },
    onLog: appendLog,
  });

  const selectionOwnedByPlayer =
    Boolean(
      normalizedPlayerId &&
        selectedDungeonOwnerRef.current === normalizedPlayerId &&
        selectedDungeonId.trim()
    );

  const {
    mapLoading,
    reloadDungeons,
    loadDetail,
    syncSession,
    startOrResume: rawStartOrResume,
    loadSelectedDungeon,
    move,
  } = useDungeonActions({
    normalizedPlayerId,
    selectedDungeonId,
    appendLog,
    applySessionUpdate,
    withLoading,
    setDungeons,
    setDungeonDetail,
    setSelectedDungeonId: setSelectedDungeonIdForPlayer,
    requestSync,
    sendMove,
  });

  const combatId = session?.currentCombatId ?? null;
  const handlePlayerSnapshot = useCallback(
    (snapshot: Combat["player"] | null) => {
      if (snapshot) {
        upsertPlayer(snapshot);
      }
    },
    [upsertPlayer]
  );

  const {
    combat,
    wsConnected: combatWsConnected,
    refreshCombat,
    selectedTargetIndex,
    selectTarget,
    attackEnemy,
  } = useCombatChannel({
    combatId,
    withLoading,
    appendLog,
    onPlayerUpdate: handlePlayerSnapshot,
  });

  useEffect(() => {
    const previousId = previousPlayerIdRef.current;
    if (previousId && previousId !== normalizedPlayerId) {
      setSession(null);
      setDungeonDetail(null);
      setSelectedDungeonIdForPlayer("");
      setCurrentRoomTemplate(null);
      setRoomTemplates(() => new Map<string, RoomTemplate>());
      setDungeons([]);
      setAutoSelectEnabled(true);
      playerDefeatHandledRef.current = false;
      dungeonClearedHandledRef.current = false;
      resetLog("Dungeon redo.");
    }
    if (normalizedPlayerId) {
      const cachedSelection =
        playerSelectedDungeonRef.current.get(normalizedPlayerId) ?? "";
      if (cachedSelection) {
        setSelectedDungeonIdForPlayer(cachedSelection);
      }
    }
    previousPlayerIdRef.current = normalizedPlayerId;
  }, [
    normalizedPlayerId,
    resetLog,
    setAutoSelectEnabled,
    setCurrentRoomTemplate,
    setDungeonDetail,
    setDungeons,
    setRoomTemplates,
    setSelectedDungeonIdForPlayer,
    setSession,
  ]);

  useEffect(() => {
    if (!normalizedPlayerId) {
      handlePlayerCleared();
      return;
    }
    void syncSession();
  }, [handlePlayerCleared, normalizedPlayerId, syncSession]);

  useEffect(() => {
    void reloadDungeons();
  }, [reloadDungeons]);

  useEffect(() => {
    if (!selectedDungeonId) {
      setDungeonDetail(null);
      return;
    }
    void loadDetail(selectedDungeonId);
  }, [loadDetail, selectedDungeonId]);

  useAutoSelectDungeon({
    dungeons,
    selectedDungeonId,
    sessionDungeonId: session?.dungeonId,
    setSelectedDungeonId: setSelectedDungeonIdForPlayer,
    autoSelectEnabled,
  });

  useCombatRefresh(session, refreshPlayers);

  const roomRefByRoomId = useMemo(() => {
    const map = new Map<string, string>();
    dungeonDetail?.rooms?.forEach((room) => {
      if (room.roomId && room.roomRefId) {
        map.set(room.roomId, room.roomRefId);
      }
    });
    return map;
  }, [dungeonDetail?.rooms]);

  const currentRoom = useMemo(
    () =>
      dungeonDetail?.rooms?.find(
        (room) => room.roomId === session?.currentRoomId
      ) ?? null,
    [dungeonDetail?.rooms, session?.currentRoomId]
  );

  const currentRoomLabel = describeRoom(currentRoom);
  const availableDirections = useMemo(() => {
    const directions = currentRoom?.doorDirections ?? [];
    return directions.filter(isDungeonDirection);
  }, [currentRoom?.doorDirections]);

  const startFreshDungeon = useCallback(
    async (reason: "death" | "cleared") => {
      if (!normalizedPlayerId) {
        appendLog(
          reason === "death"
            ? "Kan inte starta en ny dungeon efter nederlag utan vald spelare."
            : "Kan inte skapa en ny dungeon utan vald spelare."
        );
        return;
      }

      const dungeonLabel =
        (dungeonDetail?.name ?? dungeonDetail?.id ?? selectedDungeonId) ||
        "dungeon";
      const introMessage =
        reason === "death"
          ? `Spelaren f\u00F6ll i ${dungeonLabel}. Avslutar run och skapar en ny dungeon...`
          : `Dungeon ${dungeonLabel} \u00E4r rensad. Skapar en ny dungeon...`;

      appendLog(introMessage);

      setAutoSelectEnabled(false);
      setSelectedDungeonIdForPlayer("");
      setSession(null);
      setDungeonDetail(null);
      setCurrentRoomTemplate(null);
      setRoomTemplates(() => new Map<string, RoomTemplate>());

      let createdDungeon: DungeonSummary | null = null;

      try {
        await withLoading("session", async () => {
          createdDungeon = await createDungeon(normalizedPlayerId);
          if (!createdDungeon?.id) {
            appendLog("Kunde inte skapa en ny dungeon automatiskt.");
            createdDungeon = null;
            return;
          }

          const trimmedId = createdDungeon.id.trim();
          setDungeons((previous) => {
            const filtered = previous.filter(
              (candidate) => candidate.id?.trim() !== trimmedId
            );
            return [createdDungeon!, ...filtered];
          });
          setSelectedDungeonIdForPlayer(trimmedId);

          const nextSession = await postDungeonSession(
            normalizedPlayerId,
            trimmedId
          );
          if (!nextSession) {
            appendLog("Kunde inte starta sessionen f\u00F6r den nya dungeonen.");
            return;
          }

          appendLog(
            reason === "death"
              ? `Ny dungeon ${createdDungeon.name ?? trimmedId} startad. Lycka till!`
              : `Ny dungeon ${createdDungeon.name ?? trimmedId} startad efter att f\u00F6rra rensats.`
          );

          applySessionUpdate(nextSession);
          const synced = requestSync();
          appendLog(
            synced
              ? "Synk via websocket beg\u00E4rd f\u00F6r nya sessionen."
              : "Websocket ej ansluten - session uppdaterad via REST."
          );
        });
      } catch (error) {
        const reasonText =
          error instanceof Error ? error.message : String(error);
        appendLog(`Fel vid nystart av dungeon: ${reasonText}`);
        setAutoSelectEnabled(true);
        return;
      }

      if (createdDungeon) {
        await reloadDungeons();
      }

      setAutoSelectEnabled(true);
      playerDefeatHandledRef.current = false;
      dungeonClearedHandledRef.current = false;
    },
    [
      appendLog,
      applySessionUpdate,
      dungeonDetail?.id,
      dungeonDetail?.name,
      normalizedPlayerId,
      reloadDungeons,
      requestSync,
      selectedDungeonId,
      setAutoSelectEnabled,
      setCurrentRoomTemplate,
      setDungeonDetail,
      setDungeons,
      setRoomTemplates,
      setSelectedDungeonIdForPlayer,
      setSession,
      withLoading,
    ]
  );

  const startOrResume = useCallback(async () => {
    if (!selectionOwnedByPlayer) {
      setSelectedDungeonIdForPlayer("");
    }
    await rawStartOrResume();
  }, [
    rawStartOrResume,
    selectionOwnedByPlayer,
    setSelectedDungeonIdForPlayer,
  ]);

  useEffect(() => {
    if (!combat) {
      playerDefeatHandledRef.current = false;
      return;
    }

    const player = combat.player;
    if (!player) {
      return;
    }

    const hpValue =
      typeof player.hp === "number"
        ? player.hp
        : (player as unknown as { currentHp?: number | null }).currentHp ?? 0;

    if (hpValue > 0) {
      playerDefeatHandledRef.current = false;
      return;
    }

    if (!combat.combatOver) {
      return;
    }

    if (playerDefeatHandledRef.current) {
      return;
    }

    playerDefeatHandledRef.current = true;
    void startFreshDungeon("death");
  }, [combat, startFreshDungeon]);

  useEffect(() => {
    const rooms = dungeonDetail?.rooms ?? [];
    if (rooms.length === 0) {
      dungeonClearedHandledRef.current = false;
      return;
    }

    const allCleared = rooms.every((room) => room.cleared);
    if (!allCleared) {
      dungeonClearedHandledRef.current = false;
      return;
    }

    if (session?.currentCombatId) {
      return;
    }

    if (dungeonClearedHandledRef.current) {
      return;
    }

    dungeonClearedHandledRef.current = true;
    void startFreshDungeon("cleared");
  }, [dungeonDetail?.rooms, session?.currentCombatId, startFreshDungeon]);

  useEffect(() => {
    const roomId = session?.currentRoomId;
    if (!roomId) {
      setCurrentRoomTemplate(null);
      return;
    }

    const roomRefId = roomRefByRoomId.get(roomId);
    if (!roomRefId) {
      setCurrentRoomTemplate(null);
      appendLog(`Ingen rummall kopplad till roomId ${roomId}.`);
      return;
    }

    const cached = roomTemplates.get(roomRefId);
    if (cached) {
      setCurrentRoomTemplate(cached);
      return;
    }

    let cancelled = false;
    void withLoading("room", async () => {
      try {
        const template = await getRoomTemplate(roomRefId);
        if (cancelled) {
          return;
        }
        if (template) {
          setRoomTemplates((previous) => {
            const next = new Map(previous);
            next.set(roomRefId, template);
            return next;
          });
          setCurrentRoomTemplate(template);
          appendLog(
            `Rum ${template.name ?? template.id ?? roomRefId} laddat via REST.`
          );
        } else {
          appendLog(`Ingen rummall hittades (id: ${roomRefId}).`);
          setCurrentRoomTemplate(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const reason =
          error instanceof Error ? error.message : String(error);
        appendLog(`Fel vid rummall-h\u00E4mtning (${roomRefId}): ${reason}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    appendLog,
    roomRefByRoomId,
    roomTemplates,
    session?.currentRoomId,
    withLoading,
  ]);

  const combatActive = Boolean(session?.currentCombatId);

  const actions: DungeonActions = useMemo(
    () => ({
      reloadDungeons,
      startOrResume,
      syncSession,
      loadSelectedDungeon,
      move,
      refreshCombat,
      attackEnemy,
      selectCombatTarget: selectTarget,
    }),
    [
      loadSelectedDungeon,
      move,
      refreshCombat,
      reloadDungeons,
      startOrResume,
      syncSession,
      attackEnemy,
      selectTarget,
    ]
  );

  return {
    selectedPlayerName,
    normalizedPlayerId,
    dungeons,
    selectedDungeonId,
    setSelectedDungeonId: setSelectedDungeonIdForPlayer,
    dungeonDetail,
    session,
    currentRoomLabel,
    currentRoomTemplate,
    availableDirections,
    combatActive,
    combat,
    wsConnected,
    combatWsConnected,
    loading,
    loadingState,
    mapLoading,
    log,
    selectedCombatTarget: selectedTargetIndex,
    actions,
  };
}
