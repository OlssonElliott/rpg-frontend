import type { JSX } from "react";
import "./DungeonGame.css";
import { dungeonDirections, type DungeonDirection } from "./dungeonUtils";
import { useDungeonGame } from "./methods/useDungeonGame";
import type { DungeonLogEntry } from "./methods/useDungeonLog";
import type { RoomEnemySummary, RoomTemplate } from "../types/dungeon";
import type { Combat } from "../types/combat";
import { DungeonMapView } from "./DungeonMapView";

type HpCarrier = Partial<{
  hp: number;
  currentHp: number;
  maxHp: number;
}>;

function formatHpLabel(entity: HpCarrier | null | undefined): string | null {
  if (!entity) {
    return null;
  }
  const current =
    typeof entity.currentHp === "number"
      ? entity.currentHp
      : typeof entity.hp === "number"
      ? entity.hp
      : null;
  const max =
    typeof entity.maxHp === "number" ? entity.maxHp : null;

  if (current == null && max == null) {
    return null;
  }

  if (max == null) {
    return String(current ?? "?");
  }

  return `${current ?? "?"}/${max}`;
}

type DungeonRoomSectionProps = {
  currentRoomLabel: string;
  roomTemplate: RoomTemplate | null;
  roomLoading: boolean;
  availableDirections: DungeonDirection[];
  combatActive: boolean;
  loading: boolean;
  wsConnected: boolean;
  onMove: (direction: DungeonDirection) => void;
};

function DungeonRoomSection({
  currentRoomLabel,
  roomTemplate,
  roomLoading,
  availableDirections,
  combatActive,
  loading,
  wsConnected,
  onMove,
}: DungeonRoomSectionProps): JSX.Element {
  const roomEnemies = roomTemplate?.enemies ?? [];

  return (
    <section>
      <h3>Nuvarande rum</h3>
      <p>{currentRoomLabel}</p>
      {roomLoading ? (
        <p className="hint">Laddar rummall...</p>
      ) : null}
      {roomTemplate ? (
        <div className="room-template">
          <div className="room-template-header">
            <strong>{roomTemplate.name ?? "Ok\u00E4nt rum"}</strong>
          </div>
          {roomTemplate.description ? (
            <p className="room-template-description">
              {roomTemplate.description}
            </p>
          ) : null}
          <div className="room-template-enemies">
            <strong>Fiender</strong>
            {roomEnemies.length > 0 ? (
              <ul className="room-enemy-list">
                {roomEnemies.map((enemy, index) => (
                  <li key={enemy.id ?? `${enemy.name ?? "enemy"}-${index}`}>
                    <span className="room-enemy-name">
                      {enemy.name ?? enemy.id ?? "Ok\u00E4nd fiende"}
                    </span>
                    <RoomEnemyMeta enemy={enemy} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">Inga fiender definierade.</p>
            )}
          </div>
        </div>
      ) : roomLoading ? null : (
        <p className="hint">Ingen rummall har laddats \u00E4nnu.</p>
      )}
      <p>
        Tillg\u00E4ngliga riktningar:{" "}
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

type RoomEnemyMetaProps = {
  enemy: RoomEnemySummary;
};

function RoomEnemyMeta({ enemy }: RoomEnemyMetaProps): JSX.Element | null {
  const hp = formatHpLabel(enemy);
  const tags: string[] = [];
  if (typeof enemy.armor === "number") {
    tags.push(`AC ${enemy.armor}`);
  }
  if (typeof enemy.damage === "number") {
    tags.push(`DMG ${enemy.damage}`);
  }

  if (!hp && tags.length === 0) {
    return null;
  }

  return (
    <span className="room-enemy-meta">
      {hp ? `HP ${hp}` : null}
      {hp && tags.length ? " | " : ""}
      {tags.length ? tags.join(", ") : null}
    </span>
  );
}

type CombatSectionProps = {
  combat: Combat | null;
  combatActive: boolean;
  combatWsConnected: boolean;
  combatLoading: boolean;
  onRefreshCombat: () => Promise<void>;
  selectedTargetIndex: number | null;
  onSelectTarget: (index: number | null) => void;
  onAttackEnemy: (index: number) => Promise<void>;
};

function CombatSection({
  combat,
  combatActive,
  combatWsConnected,
  combatLoading,
  onRefreshCombat,
  selectedTargetIndex,
  onSelectTarget,
  onAttackEnemy,
}: CombatSectionProps): JSX.Element | null {
  if (!combatActive && !combat) {
    return null;
  }

  const player = combat?.player ?? null;
  const enemies = combat?.enemies ?? [];
  const turnLabel = combat?.playerTurn ? "Spelare" : "Fiender";
  const overLabel = combat?.combatOver ? "Ja" : "Nej";
  const playerHp = formatHpLabel(player as HpCarrier);
  const combatOver = Boolean(combat?.combatOver);
  const isPlayersTurn = Boolean(combat?.playerTurn);
  const attackDisabled =
    combatLoading || !combatActive || combatOver || !isPlayersTurn;

  return (
    <section>
      <h3>Combat</h3>
      <p>
        Combat-websocket:{" "}
        {combatWsConnected ? "ansluten" : "inte ansluten"}
      </p>
      {combatLoading ? (
        <p className="hint">Laddar combat-data...</p>
      ) : null}
      {combat ? (
        <div className="combat-summary">
          <p>
            Tur: <strong>{turnLabel}</strong> | \u00D6ver:{" "}
            <strong>{overLabel}</strong>
          </p>
          {typeof combat.enemiesXpValue === "number" ? (
            <p>XP-v\u00E4rde: {combat.enemiesXpValue}</p>
          ) : null}
          <div className="combat-blocks">
            <div className="combat-player">
              <strong>Spelare</strong>
              <div>
                {player?.name ?? player?.id ?? "Ok\u00E4nd spelare"}
                {playerHp ? <span> (HP {playerHp})</span> : null}
              </div>
            </div>
            <div className="combat-enemies">
              <strong>Fiender</strong>
              {enemies.length > 0 ? (
                <ul>
                  {enemies.map((enemy, index) => {
                    const hp = formatHpLabel(enemy as HpCarrier);
                    const alive =
                      typeof enemy.alive === "boolean"
                        ? enemy.alive
                        : (enemy.hp ?? 0) > 0;
                    const selected = selectedTargetIndex === index;
                    const label =
                      enemy.name ?? enemy.id ?? `Fiende ${index + 1}`;
                    return (
                      <li
                        key={enemy.id ?? `enemy-${index}`}
                        className={`combat-enemy${
                          alive ? "" : " combat-enemy-defeated"
                        }${selected ? " combat-enemy-selected" : ""}`}
                      >
                        <div className="combat-enemy-info">
                          <span className="combat-enemy-name">{label}</span>{" "}
                          {hp ? <span className="combat-enemy-hp">HP {hp}</span> : null}
                          <span className="combat-enemy-status">
                            {alive ? "ALIVE" : "DEAD"}
                          </span>
                        </div>
                        <div className="combat-enemy-actions">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectTarget(alive ? index : null)
                            }
                            disabled={!alive}
                          >
                            V\u00E4lj m\u00E5l
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTarget(alive ? index : null);
                              if (alive) {
                                void onAttackEnemy(index);
                              }
                            }}
                            disabled={attackDisabled || !alive}
                          >
                            Attackera
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="hint">Inga fiender i denna combat.</p>
              )}
            </div>
          </div>
          {selectedTargetIndex != null && enemies[selectedTargetIndex] ? (
            <p className="hint">
              Vald m\u00E5l:{" "}
              {enemies[selectedTargetIndex].name ??
                enemies[selectedTargetIndex].id ??
                `Fiende ${selectedTargetIndex + 1}`}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="hint">
          Combat-ID \u00E4r aktivt men detaljer har inte laddats \u00E4nnu.
        </p>
      )}
      <button
        type="button"
        disabled={combatLoading || !combatActive}
        onClick={() => void onRefreshCombat()}
      >
        Uppdatera combat
      </button>
      {combat && !isPlayersTurn ? (
        <p className="hint">
          Det \u00E4r fiendernas tur - v\u00E4nta p\u00E5 uppdatering innan du
          attackerar.
        </p>
      ) : null}
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
    currentRoomTemplate,
    availableDirections,
    combatActive,
    combat,
    wsConnected,
    combatWsConnected,
    loading,
    loadingState,
    mapLoading,
    log,
    selectedCombatTarget,
    actions,
  } = useDungeonGame();

  const {
    startOrResume,
    move,
    refreshCombat,
    attackEnemy,
    selectCombatTarget,
  } = actions;

  const activeDungeon =
    dungeons.find(
      (candidate) => candidate.id?.trim() === selectedDungeonId.trim()
    ) ?? null;
  const startDisabled =
    loadingState.session || !selectedPlayerName || !selectedDungeonId;
  const roomLoading = loadingState.room;
  const combatLoading = loadingState.combat;

  return (
    <section className="panel dungeon-game-panel">
      <div className="dungeon-game-header">
        <h2>Dungeon</h2>

        {!selectedPlayerName ? (
          <p>V\u00E4lj en karakt\u00E4r f\u00F6r att spela.</p>
        ) : (
          <p>
            Aktivt \u00E4ventyr: {selectedPlayerName} (
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
          <p>Ingen dungeon tillg\u00E4nglig \u00E4nnu.</p>
        )}

        <div className="actions dungeon-game-actions">
          <button
            type="button"
            onClick={() => void startOrResume()}
            disabled={startDisabled}
          >
            Starta / \u00E5teruppta
          </button>
        </div>

        <p className="dungeon-game-status">
          Dungeon-websocket: {wsConnected ? "ansluten" : "inte ansluten"}
        </p>
        {session?.currentCombatId ? (
          <p className="hint">
            Combat p\u00E5g\u00E5r (id: {session.currentCombatId}).
            V\u00E4nta tills striden avslutas i combat-systemet innan du
            forts\u00E4tter.
          </p>
        ) : null}
      </div>

      <div className="dungeon-game-body">
        <div className="dungeon-game-main">
          <DungeonRoomSection
            currentRoomLabel={currentRoomLabel}
            roomTemplate={currentRoomTemplate}
            roomLoading={roomLoading}
            availableDirections={availableDirections}
            combatActive={combatActive}
            loading={loading}
            wsConnected={wsConnected}
            onMove={move}
          />

          <CombatSection
            combat={combat}
            combatActive={combatActive}
            combatWsConnected={combatWsConnected}
            combatLoading={combatLoading}
            selectedTargetIndex={selectedCombatTarget}
            onSelectTarget={selectCombatTarget}
            onAttackEnemy={attackEnemy}
            onRefreshCombat={refreshCombat}
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
