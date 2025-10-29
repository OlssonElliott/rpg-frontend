// src/ws/useCombatChannel.ts
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
  // okända fält behålls i payloaden, men behövs inte här
};

export type CombatStub = {
  enemies?: EnemyStub[];
  enemyStates?: EnemyStub[]; // vissa backends använder detta istället
  isFinished?: boolean;
  finished?: boolean;
  // okända fält kan finnas, men vi bryr oss inte om dem här
  [key: string]: unknown;
};

export type CombatUpdateMessage = {
  combatId?: string;
  combat?: CombatStub | null;
  // okända fält får följa med
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

    const client = new Client({
      // STOMP över SockJS
      webSocketFactory: () => new SockJS(WS_HTTP_URL) as unknown as WebSocket,
      reconnectDelay: 2000,
      // lämna debug undefined för att slippa “empty block”-varningar
      debug: () => {},
    });

    client.onConnect = () => {
      setConnected(true);

      // Prenumerera på combat-topic
      client.subscribe(`/topic/combat/${combatId}`, (msg: IMessage) => {
        // defensiv JSON-parse → unknown → försiktig typning
        let body: unknown;
        try {
          body = JSON.parse(msg.body);
        } catch {
          return; // ogiltig JSON, ignorera
        }

        // Vi accepterar object med ev. combat/combatId
        if (typeof body === "object" && body !== null) {
          const payload = body as CombatUpdateMessage;
          setLastMsg(payload);
        }
      });

      // Begär initial sync
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
      // deactivate stänger snyggt
      client.deactivate().catch(() => {
        /* ignore close errors */
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
