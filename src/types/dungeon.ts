export type GameSession = {
  playerId?: string;
  dungeonId?: string;
  currentRoomId?: string;
  currentCombatId?: string;
  lastMoveResult?: MoveResult;
};

export type DungeonSummary = {
  id?: string;
  name?: string;
  description?: string;
  difficulty?: string;
};

export type DungeonRoomNode = {
  roomId: string;
  roomRefId?: string;
  x?: number;
  y?: number;
  doorDirections?: string[];
  connectedRoomIds?: string[];
  fromDirection?: string;
  start?: boolean;
  bossRoom?: boolean;
  cleared?: boolean;
};

export type DungeonDetail = {
  id?: string;
  name?: string;
  rooms?: DungeonRoomNode[];
};

export type RoomEnemySummary = {
  id?: string;
  name?: string;
  description?: string;
  hp?: number;
  maxHp?: number;
  armor?: number;
  damage?: number;
};

export type RoomTemplate = {
  id?: string;
  name?: string;
  description?: string;
  enemies?: RoomEnemySummary[];
};

export type MoveResult = {
  allowed: boolean;
  requestedDir: "N" | "E" | "S" | "W";
  fromRoomId: string;
  toRoomId: string;
  reason?: string | null;
  timestamp: string;
};
