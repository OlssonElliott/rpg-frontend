import { useEffect } from "react";
import type { DungeonSummary } from "../../types/dungeon";

type UseAutoSelectDungeonArgs = {
  dungeons: DungeonSummary[];
  selectedDungeonId: string;
  sessionDungeonId?: string | null;
  setSelectedDungeonId: (value: string) => void;
};

export function useAutoSelectDungeon({
  dungeons,
  selectedDungeonId,
  sessionDungeonId,
  setSelectedDungeonId,
}: UseAutoSelectDungeonArgs): void {
  useEffect(() => {
    const trimmedSelection = selectedDungeonId.trim();
    if (trimmedSelection) {
      if (trimmedSelection !== selectedDungeonId) {
        setSelectedDungeonId(trimmedSelection);
      }
      return;
    }

    const normalizedSessionId = sessionDungeonId?.trim();
    if (normalizedSessionId) {
      setSelectedDungeonId(normalizedSessionId);
      return;
    }

    const fallbackId =
      dungeons
        .map((candidate) => candidate.id?.trim() ?? "")
        .find((id) => id.length > 0) ?? "";

    if (fallbackId) {
      setSelectedDungeonId(fallbackId);
    }
  }, [dungeons, selectedDungeonId, sessionDungeonId, setSelectedDungeonId]);
}
