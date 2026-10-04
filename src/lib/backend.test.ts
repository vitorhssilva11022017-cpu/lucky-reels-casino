import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal in-memory localStorage for the Node test environment. */
function memoryStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  // Object.keys(localStorage) lists stored keys in browsers; mirror that.
  return new Proxy(store, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: (_t, k) =>
      typeof k === "string" && map.has(k) ? { enumerable: true, configurable: true, value: map.get(k) } : undefined,
  });
}

describe("backend client", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    vi.resetModules();
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never sends or saves local player state, so editing localStorage can't change the balance", async () => {
    storage.setItem("lr:guest", JSON.stringify({ id: "guest-123456", secret: "a".repeat(64) }));
    storage.setItem("guest_state_guest-123456", btoa(JSON.stringify({ balance: 999_999_999_999 })));

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ player: { balance: 2_000_000 } }), {
        status: 200,
        headers: { "X-Guest-State": btoa(JSON.stringify({ balance: 5 })) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { apiPost } = await import("./backend");
    // Legacy cached state is wiped on load.
    expect(storage.getItem("guest_state_guest-123456")).toBeNull();

    storage.setItem("guest_state_guest-123456", "tampered");
    const res = await apiPost<{ player: { balance: number } }>("/session");
    expect(res.player.balance).toBe(2_000_000);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = Object.fromEntries(Object.entries(init.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    expect(headers["x-guest-state"]).toBeUndefined();
    expect(headers["x-guest-id"]).toBe("guest-123456");
    // Nothing from the response is written back as local state.
    expect(storage.getItem("guest_state_guest-123456")).toBe("tampered");
    expect(Object.keys(storage).filter((k) => k.startsWith("guest_state_") && storage.getItem(k) !== "tampered")).toEqual([]);
  });
});
