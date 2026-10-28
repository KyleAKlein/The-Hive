import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLoggedOutWalletSession,
  shouldOpenHiveApp,
} from "../lib/wallet-session.ts";

test("logout advances the mounted wallet session and clears sensitive state", () => {
  assert.deepEqual(createLoggedOutWalletSession(7), {
    generation: 8,
    intent: null,
    recovery: "",
    keys: null,
    connected: false,
    screen: "welcome",
  });
  assert.throws(() => createLoggedOutWalletSession(-1));
  assert.throws(() => createLoggedOutWalletSession(Number.MAX_SAFE_INTEGER));
});

test("an active wallet enters the Hive app automatically", () => {
  assert.equal(shouldOpenHiveApp("active"), true);
  assert.equal(shouldOpenHiveApp("fund"), false);
  assert.equal(shouldOpenHiveApp("keys"), false);
});
