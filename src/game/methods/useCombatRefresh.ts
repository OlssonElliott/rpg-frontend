import { useEffect, useRef } from "react";
import type { GameSession } from "../../types/dungeon";

export function useCombatRefresh(
  session: GameSession | null,
  refreshPlayers: () => void | Promise<void>
): void {
  const previousCombatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousCombatId = previousCombatIdRef.current;
    if (previousCombatId && !session?.currentCombatId) {
      void refreshPlayers();
    }
    previousCombatIdRef.current = session?.currentCombatId ?? null;
  }, [refreshPlayers, session?.currentCombatId]);
}
