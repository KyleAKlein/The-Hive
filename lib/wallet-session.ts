export type WalletIntent = "join" | "restore" | null;
export type WalletConnectionDestination = "active" | "fund" | "keys";

export function shouldOpenHiveApp(
  destination: WalletConnectionDestination,
) {
  return destination === "active";
}

export function createLoggedOutWalletSession(currentGeneration: number) {
  if (
    !Number.isSafeInteger(currentGeneration) ||
    currentGeneration < 0 ||
    currentGeneration === Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("Wallet session generation must be a non-negative safe integer.");
  }

  return {
    generation: currentGeneration + 1,
    intent: null as WalletIntent,
    recovery: "",
    keys: null,
    connected: false,
    screen: "welcome" as const,
  };
}
