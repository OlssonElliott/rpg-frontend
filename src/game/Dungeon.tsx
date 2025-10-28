import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayersContext, getPlayerKey } from "../context/PlayersContext";
import {
  listDungeons,
  startSession,
  getSession,
  getDetail,
  move as doMove,
} from "../api/apiDungeon";
import type {
  DungeonDetail,
  DungeonRoomNode,
  GameSession,
} from "../types/dungeon";

// -------- Helpers --------

type DungeonDirection = "N" | "E" | "S" | "W";

function isDirection(d: string): d is DungeonDirection {
  return d === "N" || d === "E" || d === "S" || d === "W";
}

function normalize(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function describeRoom(room: DungeonRoomNode | null): string {
  if (!room) return "Okänt rum";
  if (room.start) return "Start-rum";
  if (room.bossRoom) return "Boss-rum";
  return room.roomRefId || room.roomId || "Okänt rum";
}

// -------- Component --------

export default function Dungeon() {
  const { selectedPlayer } = usePlayersContext();
  const playerId = normalize(
    selectedPlayer ? getPlayerKey(selectedPlayer) : ""
  );

  const [dungeons, setDungeons] = useState<{ id?: string; name?: string }[]>(
    []
  );
  const [selectedDungeonId, setSelectedDungeonId] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [detail, setDetail] = useState<DungeonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>(["Dungeon redo."]);
  const inCombat = Boolean(session?.currentCombatId);

  const prevRoomRef = useRef<string | null>(null);
  useEffect(() => {
    prevRoomRef.current = session?.currentRoomId ?? null;
  }, [session?.currentRoomId]);

  const selectedDungeonIdRef = useRef("");
  useEffect(() => {
    selectedDungeonIdRef.current = selectedDungeonId;
  }, [selectedDungeonId]);

  const currentRoom = useMemo(() => {
    const rooms = detail?.rooms ?? [];
    if (!rooms.length) return null;

    const sessionRoomId = normalize(session?.currentRoomId ?? "");
    if (sessionRoomId) {
      const hit = rooms.find((r) => normalize(r.roomId) === sessionRoomId);
      if (hit) return hit;
    }
    return rooms.find((r) => r.start) ?? rooms[0] ?? null;
  }, [detail?.rooms, session?.currentRoomId]);

  const currentRoomLabel = describeRoom(currentRoom);
  const availableDirections = (currentRoom?.doorDirections ?? []).filter(
    isDirection
  );

  // -------- lifecycle --------

  useEffect(() => {
    if (!playerId) {
      setDungeons([]);
      setSelectedDungeonId("");
      setSession(null);
      setDetail(null);
      setLog(["Dungeon redo."]);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const list = await listDungeons();
        setDungeons(list);

        const cur = normalize(selectedDungeonIdRef.current);
        if (list.length && !cur) {
          setSelectedDungeonId(normalize(list[0].id ?? ""));
        }

        const s = await getSession(playerId);
        setSession(s);

        const dungeonId = normalize(
          s?.dungeonId ?? selectedDungeonIdRef.current
        );
        if (dungeonId) {
          const d = await getDetail(dungeonId);
          setDetail(d);
        }
      } catch (e) {
        setLog((l) => [...l, `Fel vid init: ${String(e)}`]);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId]);

  // -------- actions --------

  async function onStartOrResume() {
    if (!playerId) return setLog((l) => [...l, "Välj karaktär först."]);

    let dungeonId = normalize(selectedDungeonId);
    setLoading(true);
    try {
      if (!dungeonId) {
        if (!dungeons.length) {
          setLog((l) => [...l, "Ingen dungeon tillgänglig."]);
          return;
        }
        dungeonId = normalize(dungeons[0].id ?? "");
        setSelectedDungeonId(dungeonId);
      }

      const s = await startSession(playerId, dungeonId);
      setSession(s);

      const d = await getDetail(dungeonId);
      setDetail(d);

      setLog((l) => [...l, `Start: session uppdaterad (${dungeonId}).`]);
    } catch (e) {
      setLog((l) => [...l, `Fel vid start: ${String(e)}`]);
    } finally {
      setLoading(false);
    }
  }

  async function onMove(dir: DungeonDirection) {
    if (!playerId)
      return setLog((l) => [...l, "Välj karaktär innan du flyttar."]);
    if (inCombat) return setLog((l) => [...l, "Kan inte flytta under strid."]);

    setLoading(true);
    try {
      const before = prevRoomRef.current ?? session?.currentRoomId ?? null;

      const s = await doMove(playerId, dir);
      console.log("MOVE response session:", s); // <— viktig!
      setSession(s);

      const after = s?.currentRoomId ?? null;

      // uppdatera dungeon-detail för säkerhets skull
      const dungeonId = normalize(s?.dungeonId ?? selectedDungeonId);
      if (dungeonId) {
        const d = await getDetail(dungeonId);
        setDetail(d);
      }

      // försök läsa lastMoveResult om det finns
      const result = (s as any)?.lastMoveResult;

      if (result) {
        if (result.allowed) {
          setLog((l) => [
            ...l,
            `Flytt OK (${result.requestedDir}) ${result.fromRoomId} → ${result.toRoomId}`,
            `RoomId: ${before ?? "?"} → ${after ?? "?"}`,
          ]);
        } else {
          setLog((l) => [
            ...l,
            `Flytt BLOCKERAD (${result.requestedDir}) – orsak: ${
              result.reason ?? "okänd"
            }`,
            `RoomId oförändrat: ${after ?? "?"}`,
          ]);
        }
      } else {
        // Fanns inget lastMoveResult i JSON → dumpa hela svaret
        setLog((l) => [
          ...l,
          `Ingen lastMoveResult i svar – dump: ${JSON.stringify(s)}`,
          `RoomId: ${before ?? "?"} → ${after ?? "?"}`,
        ]);
      }
    } catch (e) {
      setLog((l) => [...l, `Fel vid move: ${String(e)}`]);
    } finally {
      setLoading(false);
    }
  }

  // -------- render --------

  return (
    <section className="panel" style={{ display: "grid", gap: "1rem" }}>
      <h2>Dungeon (Minimal)</h2>

      {!selectedPlayer ? (
        <p>Välj en karaktär för att spela.</p>
      ) : (
        <p>Aktivt äventyr: {selectedPlayer.name}</p>
      )}

      <div>
        <label>Dungeon: </label>
        <select
          value={selectedDungeonId}
          onChange={(e) => setSelectedDungeonId(e.target.value.trim())}
          disabled={loading}
        >
          <option value="">(välj)</option>
          {dungeons.map((d) => (
            <option key={d.id ?? "?"} value={d.id ?? ""}>
              {d.name ?? d.id ?? "Okänd dungeon"}
            </option>
          ))}
        </select>
        <button
          onClick={() => void onStartOrResume()}
          disabled={loading || !playerId}
        >
          Starta / återuppta
        </button>
      </div>

      <div>
        <h3>Nuvarande rum</h3>
        {currentRoom && (
          <p>
            <small>
              roomId: {currentRoom.roomId} · doors(raw):{" "}
              {JSON.stringify(currentRoom.doorDirections ?? [])}
            </small>
          </p>
        )}
        <p>
          {currentRoomLabel}
          {currentRoom && <small> (id: {currentRoom.roomId})</small>}
        </p>
        {inCombat && (
          <p style={{ color: "#f59e0b" }}>
            I strid (combatId: {session?.currentCombatId}) – rörelse blockeras.
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,110px)",
            gap: 8,
          }}
        >
          {(["N", "E", "S", "W"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => void onMove(d)}
              disabled={loading || inCombat || !availableDirections.includes(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3>Logg</h3>
        <ul>
          {log.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
