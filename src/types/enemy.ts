export type Enemy = {
  id: string | undefined;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  damage: number;
  xpValue: number;
  alive: boolean;
};
