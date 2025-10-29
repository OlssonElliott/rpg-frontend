// src/game/CombatView.tsx
import { useEffect, useMemo } from "react";
import {
  useCombatChannel,
  type CombatStub,
  type EnemyStub,
  type CombatUpdateMessage,
} from "../websocket/useCombatChannel";
import { usePlayersContext } from "../context/PlayersContext";

/** Resultat som Dungeon.tsx kan reagera på */
export type Outcome = "ENEMIES_DEFEATED" | "PLAYER_DEAD" | "DELETED";

type Props = {
  combatId: string;
  onExit?: (outcome: Outcome) => void;
};

/* ---------------- Helpers ---------------- */

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function deriveEnemies(c: CombatStub | null | undefined): EnemyStub[] {
  if (!c) return [];
  const a = safeArray<EnemyStub>(c.enemies);
  if (a.length > 0) return a;
  const b = safeArray<EnemyStub>(c.enemyStates);
  return b;
}

// Plockar ut spelarens HP
function extractPlayerHp(combat: CombatStub): number | null {
  // 1) combat.player?.hp
  const maybePlayer = (combat as Record<string, unknown>)["player"];
  if (
    typeof maybePlayer === "object" &&
    maybePlayer !== null &&
    typeof (maybePlayer as Record<string, unknown>)["hp"] === "number"
  ) {
    return (maybePlayer as Record<string, unknown>)["hp"] as number;
  }

  // 2) combat.playerHp
  const directHp = (combat as Record<string, unknown>)["playerHp"];
  if (typeof directHp === "number") return directHp;

  // 3) combat.players?.[0]?.hp
  const players = (combat as Record<string, unknown>)["players"];
  if (Array.isArray(players) && players.length > 0) {
    const p0 = players[0];
    if (
      typeof p0 === "object" &&
      p0 !== null &&
      typeof (p0 as Record<string, unknown>)["hp"] === "number"
    ) {
      return (p0 as Record<string, unknown>)["hp"] as number;
    }
  }

  return null;
}

/* ---------------- Component ---------------- */

export default function CombatView({ combatId, onExit }: Props) {
  const { connected, lastMsg, sync, playerAction } = useCombatChannel(combatId);
  const { refreshSelectedPlayer } = usePlayersContext();

  useEffect(() => {
    void refreshSelectedPlayer();
  }, [lastMsg, refreshSelectedPlayer]);

  useEffect(() => {
    if (!lastMsg) return;

    if (lastMsg.combat == null) {
      onExit?.("DELETED");
      return;
    }

    const c = lastMsg.combat;
    const hp = extractPlayerHp(c);
    if (typeof hp === "number" && hp <= 0) {
      onExit?.("PLAYER_DEAD");
      return;
    }

    const finished = c?.isFinished === true || c?.finished === true || false;
    if (finished) {
      onExit?.("ENEMIES_DEFEATED");
    }
  }, [lastMsg, onExit]);

  const combat: CombatStub | null = (lastMsg?.combat ?? null) || null;
  const enemies: EnemyStub[] = useMemo(() => deriveEnemies(combat), [combat]);

  return (
    <section className="panel" style={{ display: "grid", gap: 12 }}>
      <h3>Combat</h3>
      <p>
        CombatId: <code>{combatId}</code>{" "}
        <small>({connected ? "WS: ansluten" : "WS: ej ansluten"})</small>
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={sync} disabled={!connected}>
          Sync
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <h4>Fiender</h4>
        {enemies.length === 0 ? (
          <p>Inga fiender.</p>
        ) : (
          <ul style={{ display: "grid", gap: 6 }}>
            {enemies.map((e, idx) => {
              const name = e.name ?? e.id ?? `Fiende ${idx + 1}`;
              const hpText =
                typeof e.maxHp === "number"
                  ? `${e.hp ?? 0}/${e.maxHp} HP`
                  : `${e.hp ?? 0} HP`;

              return (
                <li
                  key={(e.id ?? name) + ":" + idx}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span style={{ minWidth: 220 }}>
                    {idx + 1}. {name} — {hpText}
                  </span>
                  <button
                    type="button"
                    onClick={() => playerAction(idx)}
                    disabled={!connected}
                    title={`Attackera ${name}`}
                  >
                    Attackera
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details>
        <summary>Debug</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(lastMsg as CombatUpdateMessage | null, null, 2)}
        </pre>
      </details>
    </section>
  );
}
