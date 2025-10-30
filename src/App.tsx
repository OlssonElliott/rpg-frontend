import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import "./App.css";
import CreateCharacter from "./components/CreateCharacter";
import { PlayersProvider } from "./context/PlayersContext";
import SelectCharacter from "./components/SelectCharacter";
import Dungeon from "./game/Dungeon";
import BuyArmorButton from "./components/BuyArmorButton";
import CheckoutSuccess from "./components/CheckoutSuccess";
import type { UiLogEntry } from "./game/Dungeon";

// import CombatTester from "./components/CombatTester";
// import DungeonTester from "./components/DungeonTester";

function App(): JSX.Element {
  const [dungeonLog, setDungeonLog] = useState<UiLogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const normalizedPath = path === "/" ? path : path.replace(/\/+$/, "");

  // När loggen förändras så visas senaste posten direkt
  useEffect(() => {
    const node = logContainerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [dungeonLog]);

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
          {/* Samlar både system- och stridsmeddelanden från Dungeon */}
          <div style={{ display: "grid", gap: 6 }}>
            <h3 style={{ margin: 0 }}>Logg</h3>
            <div
              ref={logContainerRef}
              style={{
                maxHeight: 240,
                overflowY: "auto",
                padding: "0.75rem",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 6,
                backgroundColor: "rgba(0,0,0,0.02)",
                display: "grid",
                gap: 8,
              }}
            >
              {dungeonLog.length === 0 ? (
                <p style={{ margin: 0 }}>Ingen logg ännu.</p>
              ) : (
                <ol
                  style={{
                    display: "grid",
                    gap: 8,
                    margin: 0,
                    paddingLeft: "1.5rem",
                  }}
                >
                  {dungeonLog.map((entry) => (
                    <li key={entry.id}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <span>{entry.message}</span>
                        {entry.detail ? (
                          <small style={{ color: "#555" }}>
                            {entry.detail}
                          </small>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div className="app-secondary-column">
            <Dungeon onLogChange={setDungeonLog} />
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
