import type { CSSProperties, JSX } from "react";
import type { DungeonDetail, DungeonRoomNode } from "../types/dungeon";

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

function buildLegend(room: DungeonRoomNode, isCurrent: boolean): string {
  const tags: string[] = [];
  if (room.start) {
    tags.push("Start");
  }
  if (room.cleared) {
    tags.push("Rensad");
  }
  if (isCurrent) {
    tags.push("Nuvarande");
  }
  return tags.length > 0 ? ` (${tags.join(", ")})` : "";
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

  if (!roomsWithCoordinates.length) {
    return (
      <section className="dungeon-map-panel">
        <h3>Karta</h3>
        <ul>
          {rooms.map((room) => {
            const isCurrent = room.roomId === currentRoomId;
            const legend = buildLegend(room, isCurrent);
            const doors = room.doorDirections?.length
              ? ` \u2013 D\u00F6rrar: ${room.doorDirections.join(", ")}`
              : "";
            return (
              <li key={room.roomId}>
                {room.roomId}
                {legend}
                {doors}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const xs = roomsWithCoordinates.map((room) => room.x);
  const ys = roomsWithCoordinates.map((room) => room.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const columns = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 6rem))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 6rem))`,
    gap: "0.5rem",
    justifyContent: "start",
  };

  return (
    <section className="dungeon-map-panel">
      <h3>Karta</h3>
      <div className="dungeon-map-grid" style={gridStyle} role="grid">
        {roomsWithCoordinates.map((room) => {
          const isCurrent = room.roomId === currentRoomId;
          const gridColumn = (room.x - minX + 1).toString();
          const gridRow = (maxY - room.y + 1).toString();
          const legend = buildLegend(room, isCurrent);

          const baseBackground = room.cleared ? "#dcfce7" : "#f3f4f6";
          const backgroundColor = room.start ? "#dbeafe" : baseBackground;
          const color = "#111827";

          const style: CSSProperties = {
            gridColumn,
            gridRow,
            border: isCurrent ? "2px solid #1d4ed8" : "1px solid #d1d5db",
            borderRadius: "6px",
            padding: "0.5rem",
            backgroundColor: isCurrent ? "#1d4ed8" : backgroundColor,
            color: isCurrent ? "#f9fafb" : color,
            boxShadow: isCurrent
              ? "0 0 0 2px rgba(29, 78, 216, 0.35)"
              : undefined,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "4.5rem",
          };

          return (
            <div
              key={room.roomId}
              style={style}
              role="gridcell"
              aria-current={isCurrent ? "true" : undefined}
            >
              <strong>{room.roomId}</strong>
              {legend ? <span>{legend}</span> : null}
              <span className="dungeon-map-doors">
                {room.doorDirections?.length
                  ? `D\u00F6rrar: ${room.doorDirections.join(", ")}`
                  : "Inga d\u00F6rrar"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
