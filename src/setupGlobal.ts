// SockJS (and some STOMP helpers) förväntar sig ett Node-liknande global-objekt.
// I webbläsaren pekar vi det mot globalThis så att det fungerar utan bundler-hacks.
const globalRef = globalThis as typeof globalThis & { global?: typeof globalThis };

if (!globalRef.global) {
  globalRef.global = globalThis;
}
