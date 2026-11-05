import { request } from "node:http";
import { defineConfig, type Connect, type Plugin } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Set by the e2e run: forward /api and /_allauth to its own Django instead of using Caddy.
// Neither Vite's `server.proxy` nor Nitro's `devProxy` see these requests,
// because TanStack Start's SSR middleware answers them first (as a 404 page).
const apiProxyTarget = process.env.API_PROXY_TARGET;

function apiProxy(target: string): Plugin {
  const { hostname, port } = new URL(target);
  return {
    name: "e2e-api-proxy",
    configureServer(server) {
      const forward: Connect.NextHandleFunction = (req, res) => {
        const upstream = request(
          { hostname, port, method: req.method, path: req.originalUrl, headers: req.headers },
          (response) => {
            res.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(res);
          },
        );
        upstream.on("error", () => res.writeHead(502).end());
        req.pipe(upstream);
      };
      server.middlewares.use("/api", forward);
      server.middlewares.use("/_allauth", forward);
    },
  };
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: apiProxyTarget
    ? { hmr: false }
    : {
        // served through Caddy at https://dev.tangostack.com (see dev/caddy/Caddyfile)
        allowedHosts: ["dev.tangostack.com"],
        hmr: { protocol: "wss", host: "dev.tangostack.com", clientPort: 443 },
      },
  plugins: [
    devtools(),
    ...(apiProxyTarget ? [apiProxy(apiProxyTarget)] : []),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
