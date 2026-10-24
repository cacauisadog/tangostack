import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { enableMocking } from "#/mocks/enable";

// Wait for the mock worker so the first request is already intercepted.
enableMocking().then(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
