import { useEffect, useMemo, useRef, useState } from "react";

import { Client } from "@stomp/stompjs";
import type { IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import "./CombatTester.css";

type Enemy = {
  id: string; // templateId
  instanceId?: string; // unikt per combat
  name?: string;
  currentHp?: number;
  maxHp?: number;
  alive?: boolean;
};

type Player = {
  id: string;
  name?: string;
  currentHp?: number;
  maxHp?: number;
};

type Combat = {
  player: Player;
  enemies: Enemy[];
  playerTurn: boolean;
  combatOver: boolean;
};

const defaultBaseUrl = "http://localhost:8080/api/v1/combat";

const ts = () =>
  new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export default function CombatTester() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [playerId, setPlayerId] = useState("player-1");
  const [enemyIdsRaw, setEnemyIdsRaw] = useState("goblin-1,goblin-2");
  const [playerStarts, setPlayerStarts] = useState(true);

  const [combatId, setCombatId] = useState("");
  const [combat, setCombat] = useState<Combat | null>(null);

  const [targetIdx, setTargetIdx] = useState(0);
  const [log, setLog] = useState<string[]>([`[${ts()}] Klar.`]);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const aliveEnemies = useMemo(
    () =>
      (combat?.enemies ?? []).filter(
        (enemy) => enemy.alive ?? (enemy.currentHp ?? 1) > 0
      ),
    [combat]
  );

  const addLog = (message: string) =>
    setLog((entries) => [...entries, `[${ts()}] ${message}`]);

  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const combatIdRef = useRef(combatId);

  const resolveWsUrl = (httpUrl: string) => {
    try {
      const url = new URL(httpUrl);
      url.pathname = "/ws-combat";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  };

  const requestSync = (id: string) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      return false;
    }

    client.publish({
      destination: `/app/combat/${id}/sync`,
      body: "{}",
    });
    return true;
  };

  useEffect(() => {
    combatIdRef.current = combatId;
  }, [combatId]);

  const startCombat = async () => {
    setLoading(true);
    try {
      const url = new URL(baseUrl);
      url.pathname = url.pathname.replace(/\/+$/, "") + "/start";
      url.searchParams.set("playerId", playerId.trim());
      enemyIdsRaw
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .forEach((id) => url.searchParams.append("enemyIds", id));
      url.searchParams.set("playerStarts", String(playerStarts));

      const response = await fetch(url.toString(), { method: "POST" });
      const data = await response.json();
      addLog(`Start: ${response.status} ${JSON.stringify(data)}`);
      if (!response.ok) {
        return;
      }
      setCombatId(data.combatId);
      const synced = requestSync(data.combatId);
      if (!synced) {
        await fetchState(data.combatId);
      }
    } catch (error) {
      addLog(`Fel start: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchState = async (id = combatId) => {
    if (!id) {
      return;
    }

    setLoading(true);
    if (requestSync(id)) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/${id}`);
      const data: Combat = await response.json();
      setCombat(data);
      addLog(
        `State: ${response.status} (playerTurn=${data.playerTurn}, over=${data.combatOver})`
      );
      const firstAlive = (data.enemies ?? []).findIndex(
        (enemy) => enemy.alive ?? (enemy.currentHp ?? 1) > 0
      );
      setTargetIdx(firstAlive >= 0 ? firstAlive : 0);
    } catch (error) {
      addLog(`Fel state: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const step = async () => {
    if (!combatId) {
      return;
    }

    setLoading(true);
    try {
      const isPlayersTurn = Boolean(combat?.playerTurn);
      const client = clientRef.current;
      if (client && client.connected) {
        const payload =
          isPlayersTurn && Number.isFinite(targetIdx)
            ? { targetIdx }
            : {};
        client.publish({
          destination: `/app/combat/${combatId}/playerAction`,
          body: JSON.stringify(payload),
        });
        addLog(
          `WS Step skickad (playerTurn=${isPlayersTurn}, targetIdx=${payload.targetIdx ?? "n/a"})`
        );
        setLoading(false);
        return;
      }

      const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${combatId}/step`);
      if (isPlayersTurn) {
        url.searchParams.set("targetIdx", String(targetIdx));
      }

      const response = await fetch(url.toString(), { method: "POST" });
      const data: Combat = await response.json();
      setCombat(data);
      addLog(
        `Step: ${response.status} (playerTurn=${data.playerTurn}, over=${data.combatOver})`
      );

      const firstAlive = (data.enemies ?? []).findIndex(
        (enemy) => enemy.alive ?? (enemy.currentHp ?? 1) > 0
      );
      if (firstAlive >= 0) {
        setTargetIdx(firstAlive);
      }
    } catch (error) {
      addLog(`Fel step: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const killCombat = async () => {
    if (!combatId) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${baseUrl.replace(/\/+$/, "")}/${combatId}`,
        { method: "DELETE" }
      );
      addLog(`DELETE: ${response.status}`);
      setCombatId("");
      setCombat(null);
    } catch (error) {
      addLog(`Fel delete: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const wsUrl = resolveWsUrl(baseUrl);
    if (!wsUrl) {
      addLog("Kunde inte tolka websocket-URL baserat på Base URL.");
      return undefined;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 4000,
      debug: () => undefined,
    });

    client.onConnect = () => {
      setWsConnected(true);
      addLog("WebSocket ansluten.");
      const current = combatIdRef.current;
      if (current) {
        requestSync(current);
      }
    };

    client.onStompError = (frame) => {
      addLog(
        `WS fel: ${frame.headers["message"] ?? "okänt"}${
          frame.body ? ` - ${frame.body}` : ""
        }`
      );
    };

    client.onWebSocketClose = () => {
      setWsConnected(false);
      addLog("WebSocket frånkopplad.");
    };

    client.activate();
    clientRef.current = client;

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      setWsConnected(false);
      client.deactivate();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      return;
    }

    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    if (!combatId) {
      return;
    }

    const subscription = client.subscribe(
      `/topic/combat/${combatId}`,
      (message: IMessage) => {
        try {
          const payload = JSON.parse(
            message.body
          ) as { combatId: string; combat: Combat | null };
          if (payload.combat == null) {
            addLog("Combat avslutades (meddelande från servern).");
            setCombat(null);
            setCombatId("");
            setLoading(false);
            return;
          }

          setCombat(payload.combat);
          setLoading(false);
          addLog(
            `WS State: playerTurn=${payload.combat.playerTurn}, over=${payload.combat.combatOver}`
          );

          const firstAlive = (payload.combat.enemies ?? []).findIndex(
            (enemy) => enemy.alive ?? (enemy.currentHp ?? 1) > 0
          );
          if (firstAlive >= 0) {
            setTargetIdx(firstAlive);
          }
        } catch (error) {
          addLog(
            `WS parse-fel: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    subscriptionRef.current = subscription;
    requestSync(combatId);

    return () => {
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [combatId, wsConnected]);

  useEffect(() => {
    // valfritt: om du vill auto-polla state
    // const t = setInterval(() => combatId && fetchState(), 1500);
    // return () => clearInterval(t);
  }, [combatId]);

  return (
    <main className="app">
      <h1>Combat-test</h1>

      <section className="panel">
        <h2>Backend</h2>
        <label className="field">
          <span>Base URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <div className="grid">
          <label className="field">
            <span>playerId</span>
            <input
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>enemyIds (komma-separerat)</span>
            <input
              value={enemyIdsRaw}
              onChange={(event) => setEnemyIdsRaw(event.target.value)}
            />
          </label>
          <label className="field row">
            <input
              type="checkbox"
              checked={playerStarts}
              onChange={(event) => setPlayerStarts(event.target.checked)}
            />
            <span>playerStarts</span>
          </label>
        </div>
        <div className="actions">
          <button disabled={loading} onClick={startCombat}>
            Starta combat
          </button>
          <button disabled={loading || !combatId} onClick={() => fetchState()}>
            Hämta state
          </button>
          <button disabled={loading || !combatId} onClick={killCombat}>
            Ta bort combat
          </button>
        </div>
        <p>
          combatId: <code>{combatId || "-"}</code>
        </p>
        <p>WebSocket: {wsConnected ? "ansluten" : "ej ansluten"}</p>
      </section>

      <section className="panel">
        <h2>Runda</h2>
        <p>
          Tur: <strong>{combat?.playerTurn ? "Spelare" : "Fiender"}</strong> |
          Over: <strong>{combat?.combatOver ? "Ja" : "Nej"}</strong>
        </p>

        <div className="grid">
          <div>
            <h3>Spelare</h3>
            <pre>{JSON.stringify(combat?.player, null, 2)}</pre>
          </div>
          <div>
            <h3>Fiender</h3>
            <ol>
              {(combat?.enemies ?? []).map((enemy, index) => {
                const alive = enemy.alive ?? (enemy.currentHp ?? 1) > 0;
                const hpLabel =
                  enemy.currentHp != null && enemy.maxHp != null
                    ? ` (${enemy.currentHp}/${enemy.maxHp})`
                    : "";
                return (
                  <li key={enemy.instanceId ?? `${enemy.id}#${index}`}>
                    [{index}] {enemy.name ?? enemy.id} —{" "}
                    {alive ? "ALIVE" : "DEAD"}
                    {hpLabel}
                  </li>
                );
              })}
            </ol>
            <label className="field">
              <span>targetIdx</span>
              <input
                type="number"
                value={targetIdx}
                onChange={(event) => setTargetIdx(Number(event.target.value))}
              />
            </label>
            <p>Levande fiender: {aliveEnemies.length}</p>
          </div>
        </div>

        <button
          disabled={loading || !combatId || combat?.combatOver}
          onClick={step}
        >
          Stega tur
        </button>
      </section>

      <section className="panel log-panel">
        <h2>Logg</h2>
        <textarea readOnly className="log" value={log.join("\n")} />
      </section>
    </main>
  );
}
