import { usePlayersContext } from "../context/PlayersContext";

export default function SelectCharacter() {
  const {
    players,
    isLoading,
    selectedKey,
    selectedPlayer,
    selectPlayer,
  } = usePlayersContext();

  if (isLoading) {
    return <div>Laddar karaktärer...</div>;
  }

  if (players.length === 0) {
    return <div>Inga karaktärer hittades.</div>;
  }

  return (
    <div>
      <label htmlFor="character-select">Välj karaktär:</label>
      <select
        id="character-select"
        value={selectedKey}
        onChange={(event) => selectPlayer(event.target.value)}
      >
        {players.map((player) => (
          <option key={player.id ?? player.name} value={player.id ?? player.name}>
            {player.name}
          </option>
        ))}
      </select>

      {selectedPlayer ? (
        <div>
          <h2>{selectedPlayer.name}</h2>
          <ul>
            <li>
              HP: {selectedPlayer.hp}/{selectedPlayer.maxHp}
            </li>
            <li>Rustning: {selectedPlayer.armor}</li>
            <li>Nivå: {selectedPlayer.level}</li>
            <li>Skada: {selectedPlayer.damage}</li>
            <li>XP: {selectedPlayer.xp}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
