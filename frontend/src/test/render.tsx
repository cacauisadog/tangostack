import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, vi } from "vitest";

const clients = new Set<QueryClient>();

/** Renders with a fresh QueryClient per test (no retries, so errors surface immediately). */
export function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.add(queryClient);
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
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
