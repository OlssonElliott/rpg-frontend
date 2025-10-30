import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom"; // +++
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

  // När loggen förändras så visas senaste posten direkt
  useEffect(() => {
    const node = logContainerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [dungeonLog]);

  const mainView = (
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
                          <small style={{ color: "#555" }}>{entry.detail}</small>
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
      </div>
    </PlayersProvider>
  );
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={mainView} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout-success" element={<CheckoutSuccess />} />
        <Route path="*" element={mainView} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
