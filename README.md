Länk till backend: https://github.com/OlssonElliott/rpg-backend

# Frontend – kom igång

Ett litet roguelike-frontend byggt i React som pratar med ett dungeon/combat-API. Du kan skapa karaktärer, utforska rum, starta strider i realtid och se AI-genererade narrationsrader.

Kör fronten lokalt så här:

1. **Först**

   - Kolla så du har Node 18+
   - Klona repot och öppna mappen `rpg-frontend`.
   - Backend måste vara igång innan du startar frontend, annars fungerar inga dungeon/combat anrop.

2. **Installera dependencies**

```bash
npm install
```

3. **Konfigurera miljövariabler**

   - `.env` måste läggas till. Lägg till:
     - `VITE_API_BASE_URL` pekar mot backendens REST (`http://localhost:8080/api/v1`).
     - `VITE_WS_HTTP_URL` pekar mot backendens SockJS-endpoint (`http://localhost:8080/ws`).
   - Om du labbar mot annan port: uppdatera båda fälten.

4. **Starta dev-servern**

```bash
npm run dev
```
