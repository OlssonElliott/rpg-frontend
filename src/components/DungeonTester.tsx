import { useEffect, useMemo, useRef, useState } from "react";

import { Client } from "@stomp/stompjs";
import type { StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import "./tester-base.css";
import "./DungeonTester.css";

type GameSession = {
  playerId?: string;
  dungeonId?: string;
  currentRoomId?: string;
  currentCombatId?: string;
};

type DungeonSummary = {
  id?: string;
  name?: string;
  description?: string;
  difficulty?: string;
};

type DungeonRoomNode = {
  roomId: string;
  x?: number;
  y?: number;
  doorDirections?: string[];
  connectedRoomIds?: string[];
  start?: boolean;
  cleared?: boolean;
};

type DungeonDetail = {
  id?: string;
  name?: string;
  rooms?: DungeonRoomNode[];
};

const defaultBaseUrl = "http://localhost:8080/api/v1/dungeon";

const ts = () =>
  new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const directions = [
  { value: "N", label: "Norr", className: "move-n" },
  { value: "E", label: "Öst", className: "move-e" },
  { value: "S", label: "Syd", className: "move-s" },
  { value: "W", label: "Väst", className: "move-w" },
] as const;

const trimTrailingSlash = (input: string) => input.replace(/\/+$/, "");

export default function DungeonTester() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [playerId, setPlayerId] = useState("player-1");
  const [dungeonId, setDungeonId] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [dungeons, setDungeons] = useState<DungeonSummary[]>([]);
  const [dungeonDetail, setDungeonDetail] = useState<DungeonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [log, setLog] = useState<string[]>([
    `[${ts()}] Välkommen! Skapa eller anslut en session för att börja.`,
  ]);

  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const playerIdRef = useRef(playerId);
  const sessionRef = useRef<GameSession | null>(null);

  const addLog = (message: string) => {
    setLog((entries) => [...entries, `[${ts()}] ${message}`]);
  };

  const normalizedPlayerId = useMemo(
    () => playerId.trim(),
    [playerId]
  );

  const buildApiUrl = (path: string, params?: Record<string, string>) => {
    try {
      const url = new URL(baseUrl);
      url.pathname = `${trimTrailingSlash(url.pathname)}${path}`;
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value != null && value !== "") {
            url.searchParams.set(key, value);
          }
        });
      }
      return url.toString();
    } catch {
      return "";
    }
  };

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
    if (!client || !client.connected || !id) {
      return false;
    }

    client.publish({
      destination: `/app/dungeon/${id}/sync`,
      body: "{}",
    });
    return true;
  };

  const loadDungeon = async (id: string, showSpinner = false) => {
    const trimmed = id.trim();
    if (!trimmed) {
      setDungeonDetail(null);
      return;
    }

    const previousDungeonId = dungeonDetail?.id;

    if (showSpinner) {
      setMapLoading(true);
    }

    try {
      const url = buildApiUrl("/getById", { id: trimmed });
      if (!url) {
        addLog("Ogiltig bas-URL för dungeon-detaljer.");
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        addLog(`Dungeon-detaljer (${trimmed}): ${response.status}`);
        setDungeonDetail(null);
        return;
      }

      const data: DungeonDetail = await response.json();
      setDungeonDetail(data);
      if (showSpinner || previousDungeonId !== trimmed) {
        addLog(
          `Dungeon-detaljer (${trimmed}): ${response.status} (${data.rooms?.length ?? 0} rum)`
        );
      }
    } catch (error) {
      addLog(
        `Fel vid hämtning av dungeon ${trimmed}: ${
          error instanceof Error ? error.message : error
        }`
      );
    } finally {
      if (showSpinner) {
        setMapLoading(false);
      }
    }
  };

  const createOrJoinSession = async () => {
    if (!normalizedPlayerId || !dungeonId.trim()) {
      addLog("Ange både playerId och dungeonId innan session skapas.");
      return;
    }

    setLoading(true);
    try {
      const url = buildApiUrl("/session", {
        playerId: normalizedPlayerId,
        dungeonId: dungeonId.trim(),
      });
      if (!url) {
        addLog("Ogiltig bas-URL för sessionens endpoint.");
        return;
      }

      const response = await fetch(url, { method: "POST" });
      const data: GameSession = await response.json();
      addLog(`Session (POST): ${response.status} ${JSON.stringify(data)}`);
      if (!response.ok) {
        return;
      }
      setSession(data);
      sessionRef.current = data;
      if (data.dungeonId) {
        setDungeonId(data.dungeonId);
        void loadDungeon(data.dungeonId, false);
      }
      if (!requestSync(normalizedPlayerId)) {
        addLog("Begärde sync via REST (websocket ej ansluten).");
      }
    } catch (error) {
      addLog(`Fel vid session POST: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async () => {
    if (!normalizedPlayerId) {
      addLog("Ange playerId innan session hämtas.");
      return;
    }

    setLoading(true);
    if (requestSync(normalizedPlayerId)) {
      setLoading(false);
      return;
    }

    try {
      const url = buildApiUrl("/session", { playerId: normalizedPlayerId });
      if (!url) {
        addLog("Ogiltig bas-URL för sessionens endpoint.");
        return;
      }
      const response = await fetch(url);
      const data: GameSession = await response.json();
      setSession(data);
      sessionRef.current = data;
      addLog(`Session (GET): ${response.status} ${JSON.stringify(data)}`);
      if (data.dungeonId) {
        setDungeonId(data.dungeonId);
        void loadDungeon(data.dungeonId, false);
      }
    } catch (error) {
      addLog(`Fel vid session GET: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDungeons = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl("/getAll");
      if (!url) {
        addLog("Ogiltig bas-URL för dungeon-listan.");
        return;
      }
      const response = await fetch(url);
      const data: unknown = await response.json();
      if (Array.isArray(data)) {
        setDungeons(data as DungeonSummary[]);
        addLog(`Dungeons: ${response.status} (${data.length} st)`);
      } else {
        setDungeons([]);
        addLog(`Dungeons: ${response.status} - kunde inte tolka svaret`);
      }
    } catch (error) {
      addLog(`Fel vid dungeon-listning: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const createDungeon = async () => {
    if (!normalizedPlayerId) {
      addLog("Ange playerId innan en dungeon skapas.");
      return;
    }

    setLoading(true);
    try {
      const url = buildApiUrl("/create", { playerId: normalizedPlayerId });
      if (!url) {
        addLog("Ogiltig bas-URL för dungeon create.");
        return;
      }
      const response = await fetch(url, { method: "POST" });
      const data: DungeonSummary = await response.json();
      addLog(`Create dungeon: ${response.status} ${JSON.stringify(data)}`);
      if (response.ok && data?.id) {
        setDungeonId(data.id);
        await fetchDungeons();
        void loadDungeon(data.id, false);
      }
    } catch (error) {
      addLog(`Fel vid skapande av dungeon: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDungeon = async (id: string) => {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const url = buildApiUrl("/delete", { id });
      if (!url) {
        addLog("Ogiltig bas-URL för dungeon delete.");
        return;
      }
      const response = await fetch(url, { method: "DELETE" });
      addLog(`Delete dungeon: ${response.status} (id=${id})`);
      if (response.ok) {
        setDungeons((list) => list.filter((item) => item.id !== id));
        if (dungeonId === id) {
          setDungeonId("");
        }
        if (dungeonDetail?.id === id) {
          setDungeonDetail(null);
        }
      }
    } catch (error) {
      addLog(`Fel vid radering av dungeon: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMove = (direction: string) => {
    if (!normalizedPlayerId) {
      addLog("Ange playerId innan du flyttar.");
      return;
    }
    const client = clientRef.current;
    if (!client || !client.connected) {
      addLog("WebSocket ej ansluten - kan inte skicka move.");
      return;
    }
    client.publish({
      destination: `/app/dungeon/${normalizedPlayerId}/move`,
      body: JSON.stringify({ dir: direction }),
    });
    addLog(`WS Move skickad (${direction}).`);
  };

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

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
      addLog("WebSocket ansluten (dungeon).");
      const currentPlayer = playerIdRef.current.trim();
      if (currentPlayer) {
        requestSync(currentPlayer);
      }
    };

    client.onStompError = (frame) => {
      addLog(
        `WS dungeon fel: ${frame.headers["message"] ?? "okänt"}${
          frame.body ? ` - ${frame.body}` : ""
        }`
      );
    };

    client.onWebSocketClose = () => {
      setWsConnected(false);
      addLog("WebSocket frånkopplad (dungeon).");
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

    if (!normalizedPlayerId) {
      return;
    }

    const subscription = client.subscribe(
      `/topic/dungeon/${normalizedPlayerId}`,
      (message) => {
        try {
          const payload = JSON.parse(message.body) as GameSession;
          const previous = sessionRef.current;
          sessionRef.current = payload;
          setSession(payload);
          if (payload.dungeonId) {
            setDungeonId(payload.dungeonId);
            void loadDungeon(payload.dungeonId, false);
          }
          if (
            payload.currentCombatId &&
            payload.currentCombatId !== previous?.currentCombatId
          ) {
            addLog(`Ny combat startad: ${payload.currentCombatId}`);
          }
          if (
            previous?.currentCombatId &&
            !payload.currentCombatId
          ) {
            addLog("Combat avslutad för sessionen.");
            if (payload.dungeonId) {
              void loadDungeon(payload.dungeonId, false);
            }
          }
        } catch (error) {
          addLog(
            `WS dungeon parse-fel: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          setLoading(false);
        }
      }
    );

    subscriptionRef.current = subscription;
    requestSync(normalizedPlayerId);

    return () => {
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [normalizedPlayerId, wsConnected]);

  const dungeonLayout = useMemo(() => {
    if (!dungeonDetail?.rooms?.length) {
      return null;
    }

    const roomsWithCoords = dungeonDetail.rooms.filter(
      (room): room is DungeonRoomNode & { x: number; y: number } =>
        typeof room.x === "number" && typeof room.y === "number"
    );

    if (roomsWithCoords.length === 0) {
      return null;
    }

    const minX = Math.min(...roomsWithCoords.map((room) => room.x));
    const maxX = Math.max(...roomsWithCoords.map((room) => room.x));
    const minY = Math.min(...roomsWithCoords.map((room) => room.y));
    const maxY = Math.max(...roomsWithCoords.map((room) => room.y));

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const roomByCoordinate = new Map<string, DungeonRoomNode>();
    roomsWithCoords.forEach((room) => {
      roomByCoordinate.set(`${room.x}:${room.y}`, room);
    });

    const cells: Array<{
      key: string;
      room?: DungeonRoomNode;
      x: number;
      y: number;
    }> = [];

    for (let y = maxY; y >= minY; y -= 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = `${x}:${y}`;
        cells.push({ key, room: roomByCoordinate.get(key), x, y });
      }
    }

    return { width, height, cells };
  }, [dungeonDetail]);

  const hasActiveCombat = Boolean(session?.currentCombatId);
  const movementDisabled =
    !wsConnected || !normalizedPlayerId || !session || hasActiveCombat;

  return (
    <section className="tester dungeon-tester">
      <h1>Dungeon-test</h1>

      <section className="panel">
        <h2>Inställningar</h2>
        <label className="field">
          <span>Base URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={defaultBaseUrl}
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
            <span>dungeonId</span>
            <input
              value={dungeonId}
              onChange={(event) => setDungeonId(event.target.value)}
              placeholder="Välj från listan eller skapa ny"
            />
          </label>
        </div>
        <div className="actions">
          <button disabled={loading} onClick={createOrJoinSession}>
            Skapa/anslut session
          </button>
          <button disabled={loading} onClick={fetchSession}>
            Hämta session
          </button>
          <button
            type="button"
            disabled={!wsConnected || !normalizedPlayerId}
            onClick={() => {
              if (!requestSync(normalizedPlayerId)) {
                addLog("WebSocket ej ansluten - kunde inte synka.");
              } else {
                addLog("Sync begärd via WebSocket.");
              }
            }}
          >
            Synka via WS
          </button>
        </div>
        <p className="ws-status">
          WebSocket:{" "}
          <strong>{wsConnected ? "ansluten" : "ej ansluten"}</strong>
        </p>
      </section>

      <section className="panel">
        <h2>Session & rum</h2>
        <dl className="session-details">
          <div>
            <dt>Dungeon</dt>
            <dd>{session?.dungeonId ?? "-"}</dd>
          </div>
          <div>
            <dt>Nuvarande rum</dt>
            <dd>{session?.currentRoomId ?? "-"}</dd>
          </div>
          <div>
            <dt>Combat-id</dt>
            <dd>{session?.currentCombatId ?? "-"}</dd>
          </div>
        </dl>

        <div className="map-section">
          <div className="map-header">
            <h3>Karta</h3>
            <div className="map-actions">
              <button
                type="button"
                disabled={mapLoading || !dungeonId.trim()}
                onClick={() => {
                  if (dungeonId.trim()) {
                    void loadDungeon(dungeonId, true);
                  }
                }}
              >
                Uppdatera karta
              </button>
            </div>
          </div>

          {mapLoading && (
            <p className="hint loading-hint">Laddar karta...</p>
          )}

          {dungeonLayout ? (
            <div
              className={`dungeon-map${mapLoading ? " is-loading" : ""}`}
              style={{
                gridTemplateColumns: `repeat(${dungeonLayout.width}, minmax(90px, 1fr))`,
              }}
            >
              {dungeonLayout.cells.map(({ key, room }) => {
                if (!room) {
                  return <div key={key} className="room-tile placeholder" />;
                }

                const doors = new Set(
                  (room.doorDirections ?? []).map((dir) => dir.toUpperCase())
                );
                const isCurrent = room.roomId === session?.currentRoomId;
                const isStart = Boolean(room.start);
                const isCleared = Boolean(room.cleared);
                const tileClass = [
                  "room-tile",
                  "room-populated",
                  isCurrent ? "is-current" : "",
                  isStart ? "is-start" : "",
                  isCleared ? "is-cleared" : "needs-clear",
                  hasActiveCombat && isCurrent ? "has-combat" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div key={key} className={tileClass}>
                    <span
                      className={`door door-n ${doors.has("N") ? "active" : ""}`}
                    />
                    <span
                      className={`door door-e ${doors.has("E") ? "active" : ""}`}
                    />
                    <span
                      className={`door door-s ${doors.has("S") ? "active" : ""}`}
                    />
                    <span
                      className={`door door-w ${doors.has("W") ? "active" : ""}`}
                    />
                    <div className="room-content">
                      <span className="room-id">{room.roomId}</span>
                      <div className="room-tags">
                        {isStart ? <span className="tag">Start</span> : null}
                        {isCleared ? (
                          <span className="tag cleared">Rensad</span>
                        ) : (
                          <span className="tag pending">Ej rensad</span>
                        )}
                        {hasActiveCombat && isCurrent ? (
                          <span className="tag combat">Combat</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !mapLoading ? (
            <div className="map-empty">
              <p className="hint">
                Ingen karta laddad ännu. Välj en dungeon och tryck "Uppdatera
                karta".
              </p>
            </div>
          ) : null}

          {dungeonLayout ? (
            <div className="map-legend">
              <span>
                <span className="legend-swatch current" />
                Nuvarande rum
              </span>
              <span>
                <span className="legend-swatch start" />
                Start
              </span>
              <span>
                <span className="legend-swatch cleared" />
                Rensad
              </span>
              <span>
                <span className="legend-swatch combat" />
                Aktiv combat
              </span>
            </div>
          ) : null}
        </div>

        <div className="direction-grid">
          {directions.map((dir) => (
            <button
              key={dir.value}
              type="button"
              className={`move-btn ${dir.className}`}
              disabled={movementDisabled}
              onClick={() => sendMove(dir.value)}
            >
              {dir.label}
            </button>
          ))}
        </div>

        <p className={`hint${hasActiveCombat ? " warning" : ""}`}>
          {hasActiveCombat
            ? "Combat pågår – avsluta striden i Combat-testpanelen för att kunna röra dig vidare."
            : "Du kan bara röra dig om ingen combat är aktiv. När en combat startar syns combat-id här ovan – öppna det i Combat-testpanelen för att ta dig vidare."}
        </p>
      </section>

      <section className="panel">
        <h2>Dungeons</h2>
        <div className="actions">
          <button disabled={loading} onClick={fetchDungeons}>
            Hämta lista
          </button>
          <button disabled={loading || !normalizedPlayerId} onClick={createDungeon}>
            Skapa ny dungeon
          </button>
        </div>
        <ul className="dungeon-list">
          {dungeons.length === 0 ? (
            <li className="empty">Ingen lista hämtad ännu.</li>
          ) : (
            dungeons.map((dungeon, index) => (
              <li key={dungeon.id ?? `dungeon-${index}`}>
                <div>
                  <strong>{dungeon.name ?? dungeon.id ?? "Okänt namn"}</strong>
                  <p className="dungeon-meta">
                    id: <code>{dungeon.id ?? "-"}</code>
                    {dungeon.difficulty ? ` • svårighet: ${dungeon.difficulty}` : ""}
                  </p>
                </div>
                <div className="dungeon-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (dungeon.id) {
                        setDungeonId(dungeon.id);
                        void loadDungeon(dungeon.id, true);
                      }
                    }}
                  >
                    Välj
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => dungeon.id && deleteDungeon(dungeon.id)}
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="panel log-panel">
        <h2>Logg</h2>
        <textarea readOnly className="log" value={log.join("\n")} />
      </section>
    </section>
  );
}
