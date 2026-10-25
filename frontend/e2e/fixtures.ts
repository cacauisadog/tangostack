import { execFileSync } from "node:child_process";
import { test as base, expect } from "@playwright/test";

/** Every test starts from an empty e2e database. */
export const test = base.extend<{ cleanDatabase: void }>({
  cleanDatabase: [
    // Playwright needs the destructured first argument, even when empty
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      execFileSync("make", ["-s", "-C", "..", "e2e-flush"], { stdio: "pipe" });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
