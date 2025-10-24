import type { JSX } from "react";
import "./App.css";
import CreateCharacter from "./components/CreateCharacter";
import { PlayersProvider } from "./context/PlayersContext";
import SelectCharacter from "./components/SelectCharacter";
import { DungeonGame } from "./game";

// import CombatTester from "./components/CombatTester";
// import DungeonTester from "./components/DungeonTester";

function App(): JSX.Element {
  return (
    <PlayersProvider>
      <div className="app-shell">
        {/* <header className="app-header">
        <h1>RPG Testverktyg</h1>
        <p>
          Snabbpaneler for att prova bade dungeon-sessioner och combat-motorn.
        </p>
      </header>

      <div className="tester-grid">
        <DungeonTester />
        <CombatTester />
      </div> */}
        <CreateCharacter />
        <SelectCharacter />
        <DungeonGame />
      </div>
    </PlayersProvider>
  );
}

export default App;
