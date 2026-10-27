import type { QueryClient } from "@tanstack/react-query";
import { expect, vi } from "vitest";

// Kept free of app imports: the global setup loads this before a test file's
// `vi.mock` calls apply, so importing app modules here would pin the real ones.
const clients = new Set<QueryClient>();

/** Tracks a client so the global afterEach can wait for its in-flight requests. */
export function registerClient(queryClient: QueryClient) {
  clients.add(queryClient);
}

/**
 * Waits for in-flight requests (including refetches after a mutation) to finish,
 * so they can't leak into the next test. Called from the global afterEach.
 */
export async function settleClients() {
  await vi.waitFor(() => {
    for (const client of clients) {
      expect(client.isFetching() + client.isMutating()).toBe(0);
    }
  });
  clients.clear();
}
