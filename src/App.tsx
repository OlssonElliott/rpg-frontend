import "./App.css";

import CombatTester from "./components/CombatTester";
import DungeonTester from "./components/DungeonTester";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RPG Testverktyg</h1>
        <p>
          Snabbpaneler för att prova både dungeon-sessioner och combat-motorn.
        </p>
      </header>

      <div className="tester-grid">
        <DungeonTester />
        <CombatTester />
      </div>
    </div>
  );
}

export default App;
