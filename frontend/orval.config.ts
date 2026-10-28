import { defineConfig } from "orval";

// allauth's spec describes both the browser and app clients and every flow
// (password reset, MFA, ...). Keep the three endpoints the frontend uses, with
// `{client}` fixed to `browser` (cookie session + CSRF), under one tag.
const AUTH_OPERATION_IDS: Record<string, string> = {
  "post login": "login",
  "post signup": "signup",
  "get session": "getSession",
  "delete session": "logout",
};
const ALLAUTH_PATH = /^\/_allauth\/\{client\}\/v1\/auth\/(login|signup|session)$/;
const DROPPED_PARAMETER = /^#\/components\/parameters\/(Client|SessionToken)$/;

export default defineConfig({
  tangostack: {
    input: "../openapi/openapi.json",
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
  auth: {
    input: {
      target: "../openapi/allauth/openapi.yaml",
      parserOptions: { externalRefs: { allow: ["./description.md"] } },
      unsafeDisableValidation: true, // description.md is an external $ref that orval cannot load
      filters: { tags: ["auth"] },
      override: {
        transformer: (spec) => {
          const paths: NonNullable<typeof spec.paths> = {};
          for (const [path, item] of Object.entries(spec.paths ?? {})) {
            const match = ALLAUTH_PATH.exec(path);
            if (!match) continue;
            for (const verb of ["get", "post", "delete"] as const) {
              const operation = item[verb];
              if (!operation) continue;
              operation.tags = ["auth"];
              operation.operationId = AUTH_OPERATION_IDS[`${verb} ${match[1]}`];
              operation.parameters = operation.parameters?.filter(
                (parameter) => !("$ref" in parameter && DROPPED_PARAMETER.test(parameter.$ref)),
              );
            }
            paths[`/_allauth/browser/v1/auth/${match[1]}`] = item;
          }
          // the original description is an external markdown $ref that orval can't load
          return { ...spec, info: { ...spec.info, description: "allauth headless API" }, paths };
        },
      },
    },
    output: {
      workspace: "src/api/generated-auth",
      target: "endpoints.ts",
      schemas: "model",
      mode: "tags-split",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "../authFetcher.ts",
          name: "authFetch",
        },
      },
    },
  },
});
