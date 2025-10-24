import { useCallback, useEffect, useRef, useState } from "react";
import type { Client, StompSubscription } from "@stomp/stompjs";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { GameSession } from "../../types/dungeon";
import {
  dungeonBaseUrl,
  resolveDungeonWsUrl,
  type DungeonDirection,
} from "../dungeonUtils";

type UseDungeonSocketOptions = {
  playerId: string;
  onSessionMessage: (session: GameSession) => void;
  onLog: (message: string) => void;
};

type UseDungeonSocketResult = {
  connected: boolean;
  requestSync: () => boolean;
  sendMove: (direction: DungeonDirection) => boolean;
};

export function useDungeonSocket({
  playerId,
  onSessionMessage,
  onLog,
}: UseDungeonSocketOptions): UseDungeonSocketResult {
  const [connected, setConnected] = useState(false);

  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const playerIdRef = useRef(playerId);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  const publish = useCallback(
    (action: string, payload: unknown): boolean => {
      const currentPlayer = playerIdRef.current;
      if (!currentPlayer) {
        return false;
      }
      const client = clientRef.current;
      if (!client || !client.connected) {
        return false;
      }
      client.publish({
        destination: `/app/dungeon/${currentPlayer}/${action}`,
        body: JSON.stringify(payload),
      });
      return true;
    },
    []
  );

  const requestSync = useCallback((): boolean => {
    return publish("sync", {});
  }, [publish]);

  const sendMove = useCallback(
    (direction: DungeonDirection): boolean => {
      return publish("move", { dir: direction });
    },
    [publish]
  );

  useEffect(() => {
    const wsUrl = resolveDungeonWsUrl(dungeonBaseUrl);
    if (!wsUrl) {
      onLog("Kunde inte skapa websocket-URL.");
      return undefined;
    }

    const client = new StompClient({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      debug: () => undefined,
    });

    client.onConnect = () => {
      setConnected(true);
      onLog("Websocket ansluten.");
      void requestSync();
    };

    client.onDisconnect = () => {
      setConnected(false);
      onLog("Websocket frånkopplad.");
    };

    client.onStompError = (frame) => {
      onLog(
        `Websocketfel: ${frame.headers["message"] ?? "okänt"}${
          frame.body ? ` - ${frame.body}` : ""
        }`
      );
    };

    clientRef.current = client;
    client.activate();

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [onLog, requestSync]);

  useEffect(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    if (!playerId || !connected) {
      return;
    }

    const client = clientRef.current;
    if (!client || !client.connected) {
      return;
    }

    const subscription = client.subscribe(
      `/topic/dungeon/${playerId}`,
      (message) => {
        try {
          const payload = JSON.parse(message.body) as GameSession;
          onSessionMessage(payload);
        } catch (error) {
          onLog(
            `Kunde inte tolka dungeon-meddelande: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    subscriptionRef.current = subscription;
    requestSync();

    return () => {
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [connected, onLog, onSessionMessage, playerId, requestSync]);

  return {
    connected,
    requestSync,
    sendMove,
  };
}

