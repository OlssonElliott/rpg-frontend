import type { JSX } from "react";
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
        Tillgängliga riktningar:{" "}
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
    <section className="panel">
      <h2>Dungeon</h2>

      {!selectedPlayerName ? (
        <p>Välj en karaktär för att spela.</p>
      ) : (
        <p>
          Aktivt äventyr: {selectedPlayerName} ({normalizedPlayerId || "ok id"})
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
        <p>Ingen dungeon tillgänglig ännu.</p>
      )}

      <div className="actions">
        <button
          type="button"
          onClick={() => void startOrResume()}
          disabled={startDisabled}
        >
          Starta / återuppta
        </button>
      </div>

      <p>Websocket: {wsConnected ? "ansluten" : "inte ansluten"}</p>
      {session?.currentCombatId ? (
        <p className="hint">
          Combat pågår (id: {session.currentCombatId}). Vänta
          tills striden avslutas i combat-systemet innan du fortsätter.
        </p>
      ) : null}

      <DungeonRoomSection
        currentRoomLabel={currentRoomLabel}
        availableDirections={availableDirections}
        combatActive={combatActive}
        loading={loading}
        wsConnected={wsConnected}
        onMove={move}
      />

      <DungeonLogSection entries={log} />

      {mapLoading ? <p>Laddar karta...</p> : null}
      <DungeonMapView
        detail={dungeonDetail}
        currentRoomId={session?.currentRoomId}
      />
    </section>
  );
}
