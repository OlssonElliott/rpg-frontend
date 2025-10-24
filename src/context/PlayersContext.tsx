import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Player } from "../types/player";
import { fetchAllPlayers } from "../components/functions/Players";

type PlayersContextValue = {
  players: Player[];
  isLoading: boolean;
  selectedKey: string;
  selectedPlayer: Player | null;
  selectPlayer: (key: string) => void;
  refreshPlayers: () => Promise<void>;
  upsertPlayer: (player: Player) => void;
};

const PlayersContext = createContext<PlayersContextValue | undefined>(
  undefined
);

function playerKey(player: Player): string {
  return player.id ?? player.name;
}

export function PlayersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selectedPlayer =
    players.find((player) => playerKey(player) === selectedKey) ?? null;

  async function refreshPlayers() {
    setIsLoading(true);
    try {
      const data = await fetchAllPlayers();
      setPlayers(data);
      setSelectedKey((currentKey) => {
        if (currentKey) {
          const stillExists = data.some(
            (player) => playerKey(player) === currentKey
          );
          if (stillExists) {
            return currentKey;
          }
        }
        return data.length > 0 ? playerKey(data[0]) : "";
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshPlayers();
  }, []);

  function selectPlayer(key: string) {
    setSelectedKey(key);
  }

  function upsertPlayer(player: Player) {
    setPlayers((current) => {
      const key = playerKey(player);
      const existingIndex = current.findIndex(
        (candidate) => playerKey(candidate) === key
      );
      if (existingIndex === -1) {
        return [...current, player];
      }
      const copy = [...current];
      copy[existingIndex] = player;
      return copy;
    });
    setSelectedKey(playerKey(player));
  }

  const value: PlayersContextValue = {
    players,
    isLoading,
    selectedKey,
    selectedPlayer,
    selectPlayer,
    refreshPlayers,
    upsertPlayer,
  };

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
}

export function usePlayersContext(): PlayersContextValue {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error(
      "usePlayersContext must be used within a PlayersProvider component"
    );
  }
  return context;
}

export function getPlayerKey(player: Player): string {
  return playerKey(player);
}
