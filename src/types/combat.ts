import type { Enemy } from "./enemy";
import type { Player } from "./player";

export type Combat = {
  player: Player;
  enemies: Enemy[];
  playerTurn: boolean;
  combatOver: boolean;
  enemiesXpValue: number;
};
