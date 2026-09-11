import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Remediates the VAPT report's Missing Security Headers finding
// (CWE-693, CVSS 5.3, Medium) against http://localhost:3000/. Applied
// here (not in a Dockerfile/nginx layer) because this app has no
// reverse proxy in front of it — server.ts's fetch() is the single
// choke point every response (SSR pages, errors, static assets served
// through this handler) already passes through, dev and Docker alike.
//
// The CSP is deliberately scoped to `frame-ancestors` only. This is a
// Vite/TanStack Start SSR app that relies on inline hydration scripts
// and Vite's dev-time module injection; a broader script-src/style-src
// lockdown would need real testing against a running build (fonts,
// Supabase/API connect-src, any inline styles Tailwind/shadcn inject)
// to avoid breaking the app, which isn't something to guess at without
// verifying against your actual production build. frame-ancestors is
// additive and can't break anything that isn't already trying to frame
// this app cross-origin — it's the safe subset to ship now; broadening
// it later should go through a real dev/prod smoke test first.
//
// HSTS is added only when the request actually arrived over HTTPS —
// sending it over plain HTTP (localhost/docker dev) does nothing useful
// and risks pinning a host that isn't ready for it if a browser ever
// saw it by mistake on a not-yet-HTTPS deploy.
function withSecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  }
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!headers.has("Permissions-Policy")) {
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  }
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};
