// src/components/BuyArmorButton.tsx
import { createCheckout } from "../api/stripe";
import { usePlayersContext } from "../context/PlayersContext";
import { useState } from "react";

export default function BuyArmorButton() {
  const { selectedPlayer } = usePlayersContext();
  const [loading, setLoading] = useState(false);

  const onBuy = async () => {
    if (!selectedPlayer?.id) return alert("Välj en karaktär först.");
    setLoading(true);
    try {
      const url = await createCheckout(selectedPlayer.id);
      window.location.href = url; // redirect till Stripe Checkout
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Kunde inte starta checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onBuy} disabled={loading || !selectedPlayer}>
      {loading ? "Öppnar Stripe…" : "Pay to win. (Armor +10)"}
    </button>
  );
}
