import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createQueryClient } from "#/api/queryClient";
import { registerClient } from "./clients";

/** Renders with a fresh QueryClient per test (no retries, so errors surface immediately). */
export function renderWithClient(ui: ReactElement) {
  const queryClient = createQueryClient({ retry: false });
  registerClient(queryClient);
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
