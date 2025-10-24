import { useCallback, useEffect, useMemo, useState } from "react";
import { getPlayerKey, usePlayersContext } from "../../context/PlayersContext";
import type {
  DungeonDetail,
  DungeonSummary,
  GameSession,
} from "../../types/dungeon";
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

type DungeonActions = {
  reloadDungeons: () => Promise<void>;
  startOrResume: () => Promise<void>;
  syncSession: () => Promise<void>;
  loadSelectedDungeon: (showSpinner?: boolean) => Promise<void>;
  move: (direction: DungeonDirection) => void;
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
  availableDirections: DungeonDirection[];
  combatActive: boolean;
  wsConnected: boolean;
  loading: boolean;
  loadingState: DungeonLoadingState;
  mapLoading: boolean;
  log: DungeonLogEntry[];
  actions: DungeonActions;
};

export function useDungeonGame(): DungeonGameState {
  const { selectedPlayer, refreshPlayers } = usePlayersContext();
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
          setSelectedDungeonId(next.dungeonId);
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
    [appendLog, selectedDungeonId]
  );

  const handlePlayerCleared = useCallback(() => {
    setSession(null);
    setDungeonDetail(null);
    setSelectedDungeonId("");
    resetLog("V\u00E4lj en karakt\u00E4r f\u00F6r att b\u00F6rja.");
  }, [resetLog]);

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

  const {
    mapLoading,
    reloadDungeons,
    loadDetail,
    syncSession,
    startOrResume,
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
    requestSync,
    sendMove,
  });

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
    setSelectedDungeonId,
  });

  useCombatRefresh(session, refreshPlayers);

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

  const combatActive = Boolean(session?.currentCombatId);

  const actions: DungeonActions = useMemo(
    () => ({
      reloadDungeons,
      startOrResume,
      syncSession,
      loadSelectedDungeon,
      move,
    }),
    [loadSelectedDungeon, move, reloadDungeons, startOrResume, syncSession]
  );

  return {
    selectedPlayerName,
    normalizedPlayerId,
    dungeons,
    selectedDungeonId,
    setSelectedDungeonId,
    dungeonDetail,
    session,
    currentRoomLabel,
    availableDirections,
    combatActive,
    wsConnected,
    loading,
    loadingState,
    mapLoading,
    log,
    actions,
  };
}
