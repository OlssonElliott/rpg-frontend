import { useEffect } from "react";
import type { DungeonSummary } from "../../types/dungeon";

type UseAutoSelectDungeonArgs = {
  dungeons: DungeonSummary[];
  selectedDungeonId: string;
  sessionDungeonId?: string | null;
  setSelectedDungeonId: (value: string) => void;
  autoSelectEnabled?: boolean;
};

export function useAutoSelectDungeon({
  dungeons,
  selectedDungeonId,
  sessionDungeonId,
  setSelectedDungeonId,
  autoSelectEnabled = true,
}: UseAutoSelectDungeonArgs): void {
  useEffect(() => {
    const trimmedSelection = selectedDungeonId.trim();
    if (trimmedSelection) {
      if (trimmedSelection !== selectedDungeonId) {
        setSelectedDungeonId(trimmedSelection);
      }
      return;
    }

    if (!autoSelectEnabled) {
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
  }, [
    autoSelectEnabled,
    dungeons,
    selectedDungeonId,
    sessionDungeonId,
    setSelectedDungeonId,
  ]);
}
