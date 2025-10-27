export type GameSession = {
  playerId?: string;
  dungeonId?: string;
  currentRoomId?: string;
  currentCombatId?: string;
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
  start?: boolean;
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
