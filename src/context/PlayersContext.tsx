/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Player } from "../types/player";
import { fetchAllPlayers, getPlayerById } from "../api/players";

type PlayersContextValue = {
  players: Player[];
  isLoading: boolean;
  selectedKey: string;
  selectedPlayer: Player | null;
  selectPlayer: (key: string) => void;
  refreshPlayers: () => Promise<void>;
  // Hämta om vald spelare 
  refreshSelectedPlayer: () => Promise<void>;
  // Lägg till/uppdatera en spelare i listan och välj den 
  upsertPlayer: (player: Player) => void;
};

const PlayersContext = createContext<PlayersContextValue | undefined>(undefined);

function playerKey(player: Player): string {
  return player.id ?? player.name;
}

export function PlayersProvider({ children }: { children: ReactNode }) {
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
          const stillExists = data.some((p) => playerKey(p) === currentKey);
          if (stillExists) return currentKey;
        }
        return data.length > 0 ? playerKey(data[0]) : "";
      });
    } finally {
      setIsLoading(false);
    }
  }

  //Hämta om just vald spelare och uppdatera listan
  async function refreshSelectedPlayer(): Promise<void> {
    const id = selectedPlayer?.id;
    if (!id) return; // inget att göra om ingen vald eller saknar id
    const fresh = await getPlayerById(id);
    if (!fresh) return;

    setPlayers((prev) => {
      const key = playerKey(fresh);
      const idx = prev.findIndex((p) => playerKey(p) === key);
      if (idx === -1) return [...prev, fresh];
      const copy = prev.slice();
      copy[idx] = fresh;
      return copy;
    });
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
      const existingIndex = current.findIndex((c) => playerKey(c) === key);
      if (existingIndex === -1) return [...current, player];
      const copy = current.slice();
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
    refreshSelectedPlayer, 
    upsertPlayer,
  };

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
}

export function usePlayersContext(): PlayersContextValue {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error("usePlayersContext must be used within a PlayersProvider component");
  }
  return context;
}

export function getPlayerKey(player: Player): string {
  return playerKey(player);
}
