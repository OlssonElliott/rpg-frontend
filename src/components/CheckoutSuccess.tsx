import { useEffect, useState } from "react";
import { verifyCheckout } from "../api/stripe";

export default function CheckoutSuccess() {
  const [msg, setMsg] = useState("Verifierar betalning.");
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setMsg("Saknar session_id.");
      setIsVerifying(false);
      return;
    }

    (async () => {
      try {
        const res = await verifyCheckout(sessionId);
        if (res.ok) {
          setMsg(
            res.alreadyApplied
              ? "Redan tillämpad bonus. Tack!"
              : `Klart! Din armor är nu ${res.armor}.`
          );
        } else {
          setMsg("Betalning ej klar.");
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setMsg("Kunde inte verifiera betalning.");
      } finally {
        setIsVerifying(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <p>{msg}</p>
      <button
        type="button"
        onClick={() => {
          window.location.assign("/");
        }}
        disabled={isVerifying}
      >
        Tillbaka till spelet
      </button>
    </div>
  );
}
