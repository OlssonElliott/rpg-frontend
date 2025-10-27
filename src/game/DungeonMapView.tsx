import type { CSSProperties, JSX } from "react";
import "./DungeonMapView.css";
import type { DungeonDetail, DungeonRoomNode } from "../types/dungeon";
import { dungeonDirections, type DungeonDirection } from "./dungeonUtils";

type DungeonMapViewProps = {
  detail: DungeonDetail | null;
  currentRoomId?: string | null;
};

type RoomWithCoordinates = DungeonRoomNode & {
  x: number;
  y: number;
};

function hasCoordinates(room: DungeonRoomNode): room is RoomWithCoordinates {
  return typeof room.x === "number" && typeof room.y === "number";
}

function collectRoomTags(
  room: DungeonRoomNode,
  isCurrent: boolean
): string[] {
  const tags: string[] = [];
  if (room.start) {
    tags.push("Start");
  }
  if (room.cleared) {
    tags.push("Rensad");
  }
  if (isCurrent) {
    tags.push("Aktiv");
  }
  return tags;
}

const directionLabelMap = new Map(
  dungeonDirections.map(({ value, label }) => [value, label])
);
const directionValueSet = new Set(
  dungeonDirections.map(({ value }) => value)
);

const directionOffsets: Record<DungeonDirection, [number, number]> = {
  N: [0, 1],
  E: [1, 0],
  S: [0, -1],
  W: [-1, 0],
};

function isKnownDirection(
  direction: string
): direction is DungeonDirection {
  return directionValueSet.has(direction as DungeonDirection);
}

export function DungeonMapView({
  detail,
  currentRoomId,
}: DungeonMapViewProps): JSX.Element | null {
  const rooms = detail?.rooms ?? [];

  if (!rooms.length) {
    return null;
  }

  const roomsWithCoordinates = rooms.filter(hasCoordinates);
  const coordinateLookup = new Map<string, RoomWithCoordinates>();
  roomsWithCoordinates.forEach((room) => {
    coordinateLookup.set(`${room.x}|${room.y}`, room);
  });

  const connectorAssignments = new Map<string, Set<DungeonDirection>>();
  const assignConnector = (key: string, direction: DungeonDirection) => {
    const entry = connectorAssignments.get(key);
    if (entry) {
      entry.add(direction);
    } else {
      connectorAssignments.set(key, new Set([direction]));
    }
  };

  roomsWithCoordinates.forEach((room) => {
    const normalizedDoors = (
      room.doorDirections ?? []
    ).filter(isKnownDirection) as DungeonDirection[];

    normalizedDoors.forEach((direction: DungeonDirection) => {
      const [dx, dy] = directionOffsets[direction];
      const neighborKey = `${room.x + dx}|${room.y + dy}`;
      const neighbor = coordinateLookup.get(neighborKey);

      if (!neighbor) {
        return;
      }

      let ownerKey: string | null = null;
      let connectorDirection: DungeonDirection;

      if (room.x === neighbor.x) {
        // vertical connection
        connectorDirection = "N";
        const ownerY = Math.min(room.y, neighbor.y);
        ownerKey = `${room.x}|${ownerY}`;
      } else if (room.y === neighbor.y) {
        // horizontal connection
        connectorDirection = "E";
        const ownerX = Math.min(room.x, neighbor.x);
        ownerKey = `${ownerX}|${room.y}`;
      } else {
        return;
      }

      if (ownerKey) {
        assignConnector(ownerKey, connectorDirection);
      }
    });
  });

  if (!roomsWithCoordinates.length) {
    return (
      <section className="dungeon-map-panel">
        <h3>Karta</h3>
        <ul className="dungeon-map-list">
          {rooms.map((room, index) => {
            const isCurrent = room.roomId === currentRoomId;
            const tags = collectRoomTags(room, isCurrent);
            const directionLabels = room.doorDirections?.map((direction) => {
              const typedDirection = direction as DungeonDirection;
              return (
                directionLabelMap.get(typedDirection) ?? direction
              );
            });
            return (
              <li key={room.roomId}>
                <strong>Rum {index + 1}</strong>
                {tags.length ? (
                  <span className="dungeon-map-tags">
                    {" "}
                    ({tags.join(", ")})
                  </span>
                ) : null}
                <div className="dungeon-map-doors">
                  {directionLabels?.length
                    ? `D\u00F6rrar: ${directionLabels.join(", ")}`
                    : "Inga d\u00F6rrar"}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const xs = roomsWithCoordinates.map((room) => room.x);
  const ys = roomsWithCoordinates.map((room) => room.y);
  const uniqueSortedXs = Array.from(new Set(xs)).sort((a, b) => a - b);
  const uniqueSortedYsDesc = Array.from(new Set(ys)).sort((a, b) => b - a);
  const columns = uniqueSortedXs.length;
  const rows = uniqueSortedYsDesc.length;
  const xIndexLookup = new Map(
    uniqueSortedXs.map((value, index) => [value, index])
  );
  const yIndexLookup = new Map(
    uniqueSortedYsDesc.map((value, index) => [value, index])
  );

  const computedGapScaleY =
    rows > 0 && columns > 0 ? Math.min(Math.max(columns / rows, 0.55), 1.25) : 1;
  const gridStyle: CSSProperties & Record<string, string> = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, var(--room-size)))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, var(--room-size)))`,
    "--room-gap-scale-x": "1",
    "--room-gap-scale-y": computedGapScaleY.toString(),
  };

  return (
    <section className="dungeon-map-panel">
      <h3>Karta</h3>
      <div className="dungeon-map-wrapper">
        <div className="dungeon-map-grid" style={gridStyle} role="grid">
          {roomsWithCoordinates.map((room) => {
            const isCurrent = room.roomId === currentRoomId;
            const normalizedColumn =
              (xIndexLookup.get(room.x) ?? 0) + 1;
            const normalizedRow = (yIndexLookup.get(room.y) ?? 0) + 1;
            const gridColumn = normalizedColumn.toString();
            const gridRow = normalizedRow.toString();
            const tags = collectRoomTags(room, isCurrent);
            const directionLabels = room.doorDirections?.map((direction) => {
              const typedDirection = direction as DungeonDirection;
              return (
                directionLabelMap.get(typedDirection) ?? direction
              );
            });
            const roomKey = `${room.x}|${room.y}`;
            const connectorDirections = Array.from<DungeonDirection>(
              connectorAssignments.get(roomKey) ?? []
            );
            const positionStyle: CSSProperties = {
              gridColumn,
              gridRow,
            };
            const classNames = [
              "map-room",
              room.start ? "is-start" : "",
              room.cleared ? "is-cleared" : "",
              isCurrent ? "is-current" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={room.roomId}
                className={classNames}
                style={positionStyle}
                role="gridcell"
                aria-current={isCurrent ? "true" : undefined}
              >
                <div className="map-room-connectors" aria-hidden="true">
                  {connectorDirections.map((direction) => (
                    <span
                      key={direction}
                      className={`map-room-connector connector-${direction.toLowerCase()}`}
                    />
                  ))}
                </div>
                <div className="map-room-status">
                  {tags.length
                    ? tags.map((tag) => (
                        <span key={tag} className="map-room-tag">
                          {tag}
                        </span>
                      ))
                    : null}
                </div>
                <div className="map-room-doors" aria-hidden="true">
                  {directionLabels?.length
                    ? directionLabels.map((door) => (
                        <span key={door} className="map-room-door">
                          {door}
                        </span>
                      ))
                    : "Inga d\u00F6rrar"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="dungeon-map-legend">
        <span className="map-room-tag example-start">Start</span>
        <span className="map-room-tag example-cleared">Rensad</span>
        <span className="map-room-tag example-active">Aktiv</span>
      </div>
    </section>
  );
}
