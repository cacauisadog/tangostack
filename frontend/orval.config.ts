import { defineConfig } from "orval";

export default defineConfig({
  tangostack: {
    input: "../api/openapi.yaml",
    output: {
      workspace: "src/api/generated",
      target: "endpoints.ts",
      schemas: "model",
      mode: "tags-split",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "../fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
});
