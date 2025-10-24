import { useCallback, useRef, useState } from "react";
import { dungeonTimestamp } from "../dungeonUtils";

export type DungeonLogEntry = {
  id: string;
  timestamp: string;
  message: string;
};

export function useDungeonLog(initialMessage?: string) {
  const nextIdRef = useRef(0);

  const buildEntry = useCallback(
    (message: string): DungeonLogEntry => {
      const timestamp = dungeonTimestamp();
      const id = `${Date.now()}-${nextIdRef.current++}`;
      return { id, timestamp, message };
    },
    []
  );

  const defaultMessage = initialMessage ?? "Dungeon redo.";
  const [entries, setEntries] = useState<DungeonLogEntry[]>(() => [
    buildEntry(defaultMessage),
  ]);

  const append = useCallback(
    (message: string) => {
      setEntries((current) => [...current, buildEntry(message)]);
    },
    [buildEntry]
  );

  const reset = useCallback(
    (message: string) => {
      setEntries([buildEntry(message)]);
    },
    [buildEntry]
  );

  return {
    entries,
    append,
    reset,
  };
}
