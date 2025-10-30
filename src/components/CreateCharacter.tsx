import { useState } from "react";
import type { JSX } from "react";
import { usePlayersContext } from "../context/PlayersContext";
import { createPlayer } from "./functions/Players";

export default function CreateCharacter(): JSX.Element {
  const { upsertPlayer, refreshPlayers } = usePlayersContext();
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreatePlayer() {
    const nameToCreate = newPlayerName.trim();
    if (!nameToCreate || isCreating) return;

    setIsCreating(true);
    try {
      const created = await createPlayer(nameToCreate);
      if (created) {
        upsertPlayer(created);
        setNewPlayerName("");
      } else {
        await refreshPlayers();
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Karaktärsnamn..."
        value={newPlayerName}
        onChange={(event) => setNewPlayerName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void handleCreatePlayer();
          }
        }}
      />
      <br />
      <button
        type="button"
        onClick={() => {
          void handleCreatePlayer();
        }}
        disabled={isCreating || newPlayerName.trim().length === 0}
      >
        {isCreating ? "Skapar..." : "Skapa karaktär"}
      </button>
    </div>
  );
}
