import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayersContext } from "../context/PlayersContext";
import {
  listDungeons,
  startSession,
  getDetail,
  move as doMove,
} from "../api/apiDungeon";
import type {
  DungeonDetail,
  DungeonRoomNode,
  GameSession,
} from "../types/dungeon";
import CombatView from "./CombatView";
import type { CombatNarrationEntry } from "../websocket/useCombatChannel";

type DungeonDirection = "N" | "E" | "S" | "W";
type CombatOutcome = "ENEMIES_DEFEATED" | "PLAYER_DEAD" | "DELETED" | null;

type UiLogEntry = {
  id: string;
  kind: "system" | "narration";
  message: string;
  detail?: string;
};

function createLogEntry(
  kind: UiLogEntry["kind"],
  message: string,
  detail?: string
): UiLogEntry {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message,
    detail,
  };
}

function normalize(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function deriveDirectionsFromGraph(
  room: DungeonRoomNode | null | undefined,
  all: DungeonRoomNode[] | null | undefined
): DungeonDirection[] {
  if (!room || !all?.length) return [];
  const dirs = new Set<DungeonDirection>();
  const connected =
    ("connectedRoomIds" in room
      ? (room as { connectedRoomIds?: string[] }).connectedRoomIds
      : undefined) ?? [];
  for (const id of connected) {
    const nb = all.find(
      (r) =>
        ("roomId" in r ? (r as { roomId?: string }).roomId : undefined) === id
    );
    if (!nb) continue;
    const rx = ("x" in room ? (room as { x?: number }).x : 0) ?? 0;
    const ry = ("y" in room ? (room as { y?: number }).y : 0) ?? 0;
    const nx = ("x" in nb ? (nb as { x?: number }).x : 0) ?? 0;
    const ny = ("y" in nb ? (nb as { y?: number }).y : 0) ?? 0;
    const dx = Math.sign(nx - rx);
    const dy = Math.sign(ny - ry);
    if (dy > 0) dirs.add("N");
    if (dy < 0) dirs.add("S");
    if (dx > 0) dirs.add("E");
    if (dx < 0) dirs.add("W");
  }
  return Array.from(dirs);
}

function coerceDungeonList(raw: unknown): Array<{ id: string; name?: string }> {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((d): { id: string; name?: string } => {
      const obj: Record<string, unknown> =
        d && typeof d === "object" ? (d as Record<string, unknown>) : {};
      const idKeys = ["id", "_id", "dungeonId", "refId", "key"] as const;
      let id = "";
      for (const k of idKeys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) {
          id = v.trim();
          break;
        }
        if (typeof v === "number") {
          id = String(v);
          break;
        }
      }
      const nameKeys = ["name", "title", "displayName"] as const;
      let name: string | undefined;
      for (const k of nameKeys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) {
          name = v;
          break;
        }
      }
      return { id, name };
    })
    .filter((x) => x.id.length > 0);
}

export type { UiLogEntry };

type Props = {
  onLogChange?: (entries: UiLogEntry[]) => void;
};

export default function Dungeon({ onLogChange }: Props) {
  const { selectedPlayer } = usePlayersContext();
  const playerId = selectedPlayer?.id ?? "";

  const [dungeons, setDungeons] = useState<
    Array<{ id: string; name?: string }>
  >([]);
  const [selectedDungeonId, setSelectedDungeonId] = useState("");
  const selectedDungeonIdRef = useRef("");
  const [detail, setDetail] = useState<DungeonDetail | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<UiLogEntry[]>([]);

  // Tar emot nya narrationstext som CombatView plockar upp via websocket
  const handleNarrationEntry = useCallback((entry: CombatNarrationEntry) => {
    const attacker =
      entry.attackerName ?? entry.attackerId ?? "Okänd angripare";
    const defender = entry.defenderName ?? entry.defenderId ?? "Okänt mål";
    const damage =
      typeof entry.damageDealt === "number"
        ? `${entry.damageDealt} skada`
        : null;
    const hpAfter =
      typeof entry.defenderHpAfter === "number"
        ? `HP kvar: ${entry.defenderHpAfter}`
        : null;
    const detailParts = [
      `${attacker} -> ${defender}`,
      damage,
      hpAfter,
      entry.killingBlow ? "Dödsstöt" : null,
    ].filter(Boolean) as string[];
    const message =
      typeof entry.narration === "string" && entry.narration.trim().length > 0
        ? entry.narration
        : `${attacker} anföll ${defender}.`;

    setLog((l) => [
      ...l,
      createLogEntry(
        "narration",
        message,
        detailParts.length ? detailParts.join(", ") : undefined
      ),
    ]);
  }, []);

  useEffect(() => {
    selectedDungeonIdRef.current = selectedDungeonId;
  }, [selectedDungeonId]);
  // Synka loggen upp till App.tsx så root-komponenten kan visa hela feeden
  useEffect(() => {
    onLogChange?.(log);
  }, [log, onLogChange]);
  const inCombat = Boolean(session?.currentCombatId);

  useEffect(() => {
    if (!playerId) {
      setDungeons([]);
      setSelectedDungeonId("");
      setSession(null);
      setDetail(null);
      setLog([createLogEntry("system", "Dungeon redo.")]);
      return;
    }
    (async () => {
      try {
        const ui = coerceDungeonList(await listDungeons());
        setDungeons(ui);
        if (ui.length && !selectedDungeonIdRef.current)
          setSelectedDungeonId(ui[0].id);
      } catch (e) {
        setLog((l) => [
          ...l,
          createLogEntry("system", `Kunde inte ladda dungeons: ${String(e)}`),
        ]);
      }
    })();
  }, [playerId]);

  async function onStart() {
    if (!playerId) {
      setLog((l) => [...l, createLogEntry("system", "Välj karaktär först.")]);
      return;
    }
    const dungeonId = normalize(selectedDungeonId || dungeons[0]?.id || "");
    if (!dungeonId) {
      setLog((l) => [...l, createLogEntry("system", "Ingen dungeon vald.")]);
      return;
    }

    setLoading(true);
    try {
      // Alltid nystart
      const fresh = await startSession(playerId, dungeonId, true);
      setSession(fresh);
      const d = await getDetail(dungeonId);
      setDetail(d);
      setLog((l) => [
        ...l,
        createLogEntry("system", `Ny run startad: ${dungeonId}`),
      ]);
    } catch (e) {
      setLog((l) => [
        ...l,
        createLogEntry("system", `Fel vid start: ${String(e)}`),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function move(dir: DungeonDirection) {
    if (!playerId || !session) return;
    setLoading(true);
    try {
      // API-svaret kan innehålla nytt combatId och triggar i så fall CombatView
      const s = await doMove(playerId, dir);
      setSession(s);
    } catch (e) {
      setLog((l) => [
        ...l,
        createLogEntry("system", `Fel vid move: ${String(e)}`),
      ]);
    } finally {
      setLoading(false);
    }
  }

  const currentRoom: DungeonRoomNode | null = useMemo(() => {
    if (!detail || !session?.currentRoomId) return null;
    return (
      detail.rooms?.find(
        (r) =>
          ("roomId" in r ? (r as { roomId?: string }).roomId : undefined) ===
          session.currentRoomId
      ) ?? null
    );
  }, [detail, session]);

  const allowedDirs = useMemo(
    () => deriveDirectionsFromGraph(currentRoom, detail?.rooms),
    [currentRoom, detail?.rooms]
  );

  return (
    <section className="panel" style={{ display: "grid", gap: "1rem" }}>
      <h2>Dungeon</h2>
      {!selectedPlayer ? (
        <p>Välj en karaktär för att spela.</p>
      ) : (
        <p>Aktivt äventyr: {selectedPlayer.name}</p>
      )}

      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <select
          value={selectedDungeonId}
          onChange={(e) => setSelectedDungeonId(e.target.value)}
          disabled={loading || inCombat}
        >
          {dungeons.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name ?? d.id}
            </option>
          ))}
        </select>

        <button onClick={onStart} disabled={loading || inCombat}>
          {session ? "Starta ny" : "Starta"}
        </button>
      </div>

      {session && !inCombat && (
        <div className="p-2 rounded border">
          <div className="font-semibold mb-1">
            {currentRoom
              ? "roomId" in currentRoom
                ? (currentRoom as { roomId?: string }).roomId
                : "Rum"
              : "Rum"}
          </div>
          <div className="flex gap-2">
            {(["N", "E", "S", "W"] as const).map((d) => (
              <button
                key={d}
                disabled={loading || !allowedDirs.includes(d)}
                onClick={() => move(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {inCombat && session?.currentCombatId && (
        <CombatView
          combatId={session.currentCombatId}
          onNarration={handleNarrationEntry}
          onExit={async (outcome?: CombatOutcome) => {
            try {
              if (!playerId) return;

              if (outcome === "PLAYER_DEAD") {
                setSession(null);
                const dungeonId = normalize(
                  selectedDungeonIdRef.current || selectedDungeonId || ""
                );
                if (dungeonId) {
                  const fresh = await startSession(playerId, dungeonId, true);
                  setSession(fresh);
                  const d = await getDetail(dungeonId);
                  setDetail(d);
                  setLog((l) => [
                    ...l,
                    createLogEntry("system", "Du dog - ny run startad."),
                  ]);
                }
                return;
              }

              setLog((l) => [
                ...l,
                createLogEntry(
                  "system",
                  "Strid avslutad. Klicka 'Starta ny' för nästa run."
                ),
              ]);
              setSession(null);
            } catch (e) {
              setLog((l) => [
                ...l,
                createLogEntry("system", `Fel vid post-combat: ${String(e)}`),
              ]);
            }
          }}
        />
      )}
    </section>
  );
}
