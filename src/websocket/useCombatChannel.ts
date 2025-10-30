import { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// --------- Minimala, försiktiga typer för combat-payload ---------

export type EnemyStub = {
  id?: string;
  name?: string;
  hp?: number;
  maxHp?: number;
};

export type CombatNarrationEntry = {
  attackerId?: string;
  attackerName?: string;
  defenderId?: string;
  defenderName?: string;
  damageDealt?: number;
  defenderHpAfter?: number;
  killingBlow?: boolean;
  narration?: string;
  [key: string]: unknown;
};

export type CombatStub = {
  enemies?: EnemyStub[];
  enemyStates?: EnemyStub[];
  narrationLog?: CombatNarrationEntry[];
  isFinished?: boolean;
  finished?: boolean;
  [key: string]: unknown;
};

export type CombatUpdateMessage = {
  combatId?: string;
  combat?: CombatStub | null;
  [key: string]: unknown;
};

// --------- Hook ---------

export function useCombatChannel(combatId: string | null | undefined) {
  const [connected, setConnected] = useState(false);
  const [lastMsg, setLastMsg] = useState<CombatUpdateMessage | null>(null);
  const clientRef = useRef<Client | null>(null);

  // SockJS endpoint (http/https), inte ws://
  const WS_HTTP_URL =
    import.meta.env.VITE_WS_HTTP_URL ?? "http://localhost:8080/ws";

  useEffect(() => {
    if (!combatId) return;

    // Skapa STOMP-klient för aktuell combat
    const client = new Client({
      // STOMP över SockJS
      webSocketFactory: () => new SockJS(WS_HTTP_URL) as unknown as WebSocket,
      reconnectDelay: 2000,
      debug: () => {},
    });

    client.onConnect = () => {
      setConnected(true);

      // Prenumerera på combat-topic
      client.subscribe(`/topic/combat/${combatId}`, (msg: IMessage) => {
        let body: unknown;
        try {
          body = JSON.parse(msg.body);
        } catch {
          return; 
        }

        if (typeof body === "object" && body !== null) {
          const payload = body as CombatUpdateMessage;
          setLastMsg(payload);
        }
      });

      client.publish({
        destination: `/app/combat/${combatId}/sync`,
        body: "",
      });

      clientRef.current = client;
    };

    client.onStompError = () => {
      setConnected(false);
    };
    client.onWebSocketClose = () => {
      setConnected(false);
    };

    client.activate();

    return () => {
      setConnected(false);
      clientRef.current = null;
      // Avsluta för att undvika kvarhängande sockets mellan combat-id:n
      client.deactivate().catch(() => {
      });
    };
  }, [combatId, WS_HTTP_URL]);

  const sync = useCallback(() => {
    const c = clientRef.current;
    if (!combatId || !c || !connected) return;
    c.publish({ destination: `/app/combat/${combatId}/sync`, body: "" });
  }, [combatId, connected]);

  const playerAction = useCallback(
    (targetIdx: number | null | undefined) => {
      const c = clientRef.current;
      if (!combatId || !c || !connected) return;
      const payload = JSON.stringify({ targetIdx });
      c.publish({
        destination: `/app/combat/${combatId}/playerAction`,
        body: payload,
      });
    },
    [combatId, connected]
  );

  return { connected, lastMsg, sync, playerAction };
}
