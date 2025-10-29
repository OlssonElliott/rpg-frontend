import type { JSX } from "react";
import "./App.css";
import CreateCharacter from "./components/CreateCharacter";
import { PlayersProvider } from "./context/PlayersContext";
import SelectCharacter from "./components/SelectCharacter";
import Dungeon from "./game/Dungeon";
import BuyArmorButton from "./components/BuyArmorButton";
import CheckoutSuccess from "./components/CheckoutSuccess";

// import CombatTester from "./components/CombatTester";
// import DungeonTester from "./components/DungeonTester";

function App(): JSX.Element {
  const path =
    typeof window === "undefined" ? "/" : window.location.pathname;
  const normalizedPath =
    path === "/" ? path : path.replace(/\/+$/, "");

  if (
    normalizedPath === "/checkout-success" ||
    normalizedPath === "/checkout/success"
  ) {
    return <CheckoutSuccess />;
  }

  return (
    <PlayersProvider>
      <div className="app-shell">
        <div className="app-primary-layout">
          <div className="app-primary-column">
            <CreateCharacter />
            <SelectCharacter />
          </div>
          <BuyArmorButton />
          <div className="app-secondary-column">
            <Dungeon />
          </div>
        </div>
        {/*
        <header className="app-header">
          <h1>RPG Testverktyg</h1>
          <p>
            Snabbpaneler for att prova bade dungeon-sessioner och combat-motorn.
          </p>
        </header>

        <div className="tester-grid">
          <DungeonTester />
          <CombatTester />
        </div>
        */}
      </div>
    </PlayersProvider>
  );
}

export default App;
