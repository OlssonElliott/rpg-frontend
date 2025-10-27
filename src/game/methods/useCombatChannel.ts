import { useCallback, useEffect, useRef, useState } from "react";
import type { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { Combat } from "../../types/combat";
import { getCombatState } from "../dungeonApi";
import { resolveDungeonWsUrl } from "../dungeonUtils";
import type { DungeonLoadingState } from "./useDungeonLoading";

const combatBaseUrl = new URL(
  "./combat",
  import.meta.env.VITE_API_URL
).toString();

type CombatEnemy = Combat["enemies"][number] | undefined;

function isEnemyAlive(enemy: CombatEnemy): boolean {
  if (!enemy) {
    return false;
  }
  if (typeof enemy.alive === "boolean") {
    return enemy.alive;
  }
  if (typeof enemy.hp === "number") {
    return enemy.hp > 0;
  }
  const candidate = (enemy as { currentHp?: number | undefined }).currentHp;
  return (candidate ?? 0) > 0;
}

type UseCombatChannelArgs = {
  combatId: string | null;
  withLoading: <T>(
    key: keyof DungeonLoadingState,
    task: () => Promise<T>
  ) => Promise<T>;
  appendLog: (message: string) => void;
  onPlayerUpdate?: (player: Combat["player"] | null) => void;
};

type UseCombatChannelResult = {
  combat: Combat | null;
  wsConnected: boolean;
  refreshCombat: (id?: string | null) => Promise<void>;
  selectedTargetIndex: number | null;
  selectTarget: (index: number | null) => void;
  attackEnemy: (enemyIndex?: number | null) => Promise<void>;
};

export function useCombatChannel({
  combatId,
  withLoading,
  appendLog,
  onPlayerUpdate,
}: UseCombatChannelArgs): UseCombatChannelResult {
  const [combat, setCombat] = useState<Combat | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const combatIdRef = useRef<string | null>(combatId);
  const disposedRef = useRef(false);
  const actionInFlightRef = useRef(false);
  const playerUpdateRef = useRef(onPlayerUpdate);

  useEffect(() => {
    playerUpdateRef.current = onPlayerUpdate;
  }, [onPlayerUpdate]);

  useEffect(() => {
    if (!combat?.enemies?.length) {
      setTargetIndex(null);
      return;
    }

    setTargetIndex((current) => {
      if (current != null && isEnemyAlive(combat.enemies[current])) {
        return current;
      }

      const firstAlive = combat.enemies.findIndex((candidate) =>
        isEnemyAlive(candidate)
      );

      return firstAlive >= 0 ? firstAlive : null;
    });
  }, [combat?.enemies]);

  useEffect(() => {
    const trimmed = combatId?.trim() ?? "";
    combatIdRef.current = trimmed || null;
    if (!trimmed) {
      setCombat(null);
    }
  }, [combatId]);

  const fetchCombat = useCallback(
    async (id = combatIdRef.current): Promise<void> => {
      const targetId = id?.trim();
      if (!targetId) {
        setCombat(null);
        return;
      }

      try {
        await withLoading("combat", async () => {
          const state = await getCombatState(targetId);
          if (disposedRef.current) {
            return;
          }
          if (state) {
            setCombat(state);
            playerUpdateRef.current?.(state.player ?? null);
            appendLog(
              `Combat ${targetId} uppdaterad via REST (playerTurn=${
                state.playerTurn ? "spelare" : "fiender"
              }).`
            );
          } else {
            setCombat(null);
            playerUpdateRef.current?.(null);
            appendLog(`Combat-data saknas (id: ${targetId}).`);
          }
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        appendLog(`Fel vid combat-uppdatering (${targetId}): ${reason}`);
      }
    },
    [appendLog, withLoading]
  );

  useEffect(() => {
    disposedRef.current = false;
    const wsUrl = resolveDungeonWsUrl(combatBaseUrl);
    if (!wsUrl) {
      appendLog("Kunde inte skapa combat-websocket-URL.");
      return () => {
        disposedRef.current = true;
      };
    }

    const client = new StompClient({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      debug: () => undefined,
    });

    client.onConnect = () => {
      if (disposedRef.current) {
        return;
      }
      setWsConnected(true);
      appendLog("Combat-websocket ansluten.");
      const current = combatIdRef.current;
      if (current) {
        client.publish({
          destination: `/app/combat/${current}/sync`,
          body: "{}",
        });
      }
    };

    client.onDisconnect = () => {
      if (disposedRef.current) {
        return;
      }
      setWsConnected(false);
      appendLog("Combat-websocket fr\u00E5nkopplad.");
    };

    client.onStompError = (frame) => {
      if (disposedRef.current) {
        return;
      }
      appendLog(
        `Combat-websocketfel: ${frame.headers["message"] ?? "ok\u00E4nt"}${
          frame.body ? ` - ${frame.body}` : ""
        }`
      );
    };

    clientRef.current = client;
    client.activate();

    return () => {
      disposedRef.current = true;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      setWsConnected(false);
      client.deactivate();
      clientRef.current = null;
    };
  }, [appendLog]);

  useEffect(() => {
    const client = clientRef.current;
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    const normalizedId = combatId?.trim() ?? "";
    if (!normalizedId) {
      setCombat(null);
      return;
    }

    if (!client || !client.connected) {
      return;
    }

    combatIdRef.current = normalizedId;

    const subscription = client.subscribe(
      `/topic/combat/${normalizedId}`,
      (message: IMessage) => {
        try {
          const payload = JSON.parse(
            message.body
          ) as { combatId: string; combat: Combat | null };

          if (!payload.combat) {
            setCombat(null);
            playerUpdateRef.current?.(null);
            appendLog(
              `Combat ${payload.combatId} avslutad (meddelande fr\u00E5n server).`
            );
            return;
          }

          setCombat(payload.combat);
          playerUpdateRef.current?.(payload.combat.player ?? null);
          appendLog(
            `Combat-uppdatering via WS (id=${
              payload.combatId
            }, playerTurn=${payload.combat.playerTurn ? "spelare" : "fiender"})`
          );
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          appendLog(`Kunde inte tolka combat-meddelande: ${reason}`);
        }
      }
    );

    subscriptionRef.current = subscription;
    client.publish({
      destination: `/app/combat/${normalizedId}/sync`,
      body: "{}",
    });

    void fetchCombat(normalizedId);

    return () => {
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [appendLog, combatId, fetchCombat, wsConnected]);

  const performCombatStep = useCallback(
    async (targetIdx: number | null, auto = false) => {
      const currentCombatId = combatIdRef.current?.trim();
      if (!currentCombatId) {
        if (!auto) {
          appendLog("Ingen combat \u00E4r aktiv just nu.");
        }
        return;
      }

      if (actionInFlightRef.current) {
        return;
      }

      actionInFlightRef.current = true;
      try {
        const client = clientRef.current;
        const payload =
          targetIdx != null ? { targetIdx } : {};

        if (client && client.connected) {
          client.publish({
            destination: `/app/combat/${currentCombatId}/playerAction`,
            body: JSON.stringify(payload),
          });
          appendLog(
            `${auto ? "Automatisk fiendetur" : "Combat-aktion"} skickad via WS (targetIdx=${payload.targetIdx ?? "n/a"}).`
          );
          return;
        }

        await withLoading("combat", async () => {
          const url = new URL(
            `${combatBaseUrl.replace(/\/+$/, "")}/${currentCombatId}/step`
          );
          if (payload.targetIdx != null) {
            url.searchParams.set("targetIdx", String(payload.targetIdx));
          }

          const response = await fetch(url.toString(), { method: "POST" });
          if (!response.ok) {
            appendLog(`Combat-aktion misslyckades (${response.status}).`);
            return;
          }
          const data = (await response.json()) as Combat;
          setCombat(data);
          playerUpdateRef.current?.(data.player ?? null);
          appendLog(
            `Combat uppdaterad via REST (playerTurn=${
              data.playerTurn ? "spelare" : "fiender"
            }).`
          );
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        appendLog(`Fel vid combat-aktion: ${reason}`);
      } finally {
        actionInFlightRef.current = false;
      }
    },
    [appendLog, withLoading]
  );

  useEffect(() => {
    if (!combat || combat.combatOver) {
      return;
    }
    if (combat.playerTurn) {
      return;
    }
    void performCombatStep(null, true);
  }, [combat, performCombatStep]);

  const selectTarget = useCallback(
    (index: number | null) => {
      if (index == null) {
        setTargetIndex(null);
        return;
      }

      const enemies = combat?.enemies ?? [];
      if (
        index < 0 ||
        index >= enemies.length ||
        !isEnemyAlive(enemies[index])
      ) {
        return;
      }
      setTargetIndex(index);
    },
    [combat]
  );

  const attackEnemy = useCallback(
    async (enemyIndex?: number | null) => {
      const resolvedIndex =
        enemyIndex != null ? enemyIndex : targetIndex ?? null;

      if (resolvedIndex == null) {
        appendLog("Ingen fiende vald f\u00F6r attack.");
        return;
      }

      const enemies = combat?.enemies ?? [];
      const target = enemies[resolvedIndex];
      if (!target) {
        appendLog(`Fiende-index ${resolvedIndex} hittades inte.`);
        return;
      }
      if (!isEnemyAlive(target)) {
        appendLog(
          `${target.name ?? target.id ?? `Fiende ${resolvedIndex + 1}`} \u00E4r redan besegrad.`
        );
        return;
      }

      await performCombatStep(resolvedIndex, false);
    },
    [appendLog, combat, performCombatStep, targetIndex]
  );

  return {
    combat,
    wsConnected,
    refreshCombat: fetchCombat,
    selectedTargetIndex: targetIndex,
    selectTarget,
    attackEnemy,
  };
}
