import type { JSX } from "react";
import "./DungeonGame.css";
import { dungeonDirections, type DungeonDirection } from "./dungeonUtils";
import { useDungeonGame } from "./methods/useDungeonGame";
import type { DungeonLogEntry } from "./methods/useDungeonLog";
import { DungeonMapView } from "./DungeonMapView";

type DungeonRoomSectionProps = {
  currentRoomLabel: string;
  availableDirections: DungeonDirection[];
  combatActive: boolean;
  loading: boolean;
  wsConnected: boolean;
  onMove: (direction: DungeonDirection) => void;
};

function DungeonRoomSection({
  currentRoomLabel,
  availableDirections,
  combatActive,
  loading,
  wsConnected,
  onMove,
}: DungeonRoomSectionProps): JSX.Element {
  return (
    <section>
      <h3>Nuvarande rum</h3>
      <p>{currentRoomLabel}</p>
      <p>
        Tillg�ngliga riktningar:{" "}
        {availableDirections.length > 0
          ? availableDirections.join(", ")
          : "Inga"}
      </p>
      <div className="direction-grid">
        {dungeonDirections.map((direction) => {
          const disabled =
            combatActive ||
            !availableDirections.includes(direction.value) ||
            loading ||
            !wsConnected;

          return (
            <button
              key={direction.value}
              type="button"
              disabled={disabled}
              onClick={() => onMove(direction.value)}
            >
              {direction.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type DungeonLogSectionProps = {
  entries: DungeonLogEntry[];
};

function DungeonLogSection({ entries }: DungeonLogSectionProps): JSX.Element {
  return (
    <section>
      <h3>Logg</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="log-timestamp">[{entry.timestamp}]</span>{" "}
            {entry.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DungeonGame(): JSX.Element {
  const {
    selectedPlayerName,
    normalizedPlayerId,
    dungeons,
    selectedDungeonId,
    dungeonDetail,
    session,
    currentRoomLabel,
    availableDirections,
    combatActive,
    wsConnected,
    loading,
    loadingState,
    mapLoading,
    log,
    actions,
  } = useDungeonGame();

  const { startOrResume, move } = actions;

  const activeDungeon =
    dungeons.find(
      (candidate) => candidate.id?.trim() === selectedDungeonId.trim()
    ) ?? null;
  const startDisabled =
    loadingState.session || !selectedPlayerName || !selectedDungeonId;

  return (
    <section className="panel dungeon-game-panel">
      <div className="dungeon-game-header">
        <h2>Dungeon</h2>

        {!selectedPlayerName ? (
          <p>V�lj en karakt�r f�r att spela.</p>
        ) : (
          <p>
            Aktivt �ventyr: {selectedPlayerName} (
            {normalizedPlayerId || "ok id"})
          </p>
        )}

        {loadingState.list ? (
          <p>Laddar dungeon...</p>
        ) : activeDungeon ? (
          <p>
            Dungeon tilldelad:{" "}
            {activeDungeon.name ?? activeDungeon.id ?? "ok dungeon"}
          </p>
        ) : (
          <p>Ingen dungeon tillg�nglig �nnu.</p>
        )}

        <div className="actions dungeon-game-actions">
          <button
            type="button"
            onClick={() => void startOrResume()}
            disabled={startDisabled}
          >
            Starta / �teruppta
          </button>
        </div>

        <p className="dungeon-game-status">
          Websocket: {wsConnected ? "ansluten" : "inte ansluten"}
        </p>
        {session?.currentCombatId ? (
          <p className="hint">
            Combat p�g�r (id: {session.currentCombatId}). V�nta
            tills striden avslutas i combat-systemet innan du forts�tter.
          </p>
        ) : null}
      </div>

      <div className="dungeon-game-body">
        <div className="dungeon-game-main">
          <DungeonRoomSection
            currentRoomLabel={currentRoomLabel}
            availableDirections={availableDirections}
            combatActive={combatActive}
            loading={loading}
            wsConnected={wsConnected}
            onMove={move}
          />

          <DungeonLogSection entries={log} />
        </div>

        <aside className="dungeon-game-map">
          {mapLoading ? (
            <p className="dungeon-map-loading">Laddar karta...</p>
          ) : null}
          <DungeonMapView
            detail={dungeonDetail}
            currentRoomId={session?.currentRoomId}
          />
        </aside>
      </div>
    </section>
  );
}
