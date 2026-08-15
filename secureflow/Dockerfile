# syntax=docker/dockerfile:1
#
# LOCAL/DEV-COMPOSE IMAGE ONLY — see the chat message this shipped with for
# why this deliberately runs the dev server instead of a production build.
# Short version: this app's src/server.ts exports a Cloudflare-Workers-shaped
# fetch(request, env, ctx) handler, and Nitro's default preset here is
# cloudflare — so "build + serve with nginx/node" is not a drop-in job the
# way it would be for a plain static Vite SPA. That's a real, separate
# decision (see chat) — this image only solves "make docker compose up work
# locally", not "self-host this in production".
FROM oven/bun:1-slim

WORKDIR /app

# Install deps first so this layer caches across source-only changes
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

# Bun's dev server needs an explicit host to be reachable from outside the
# container (defaults to localhost, which is unreachable from the host
# machine / other compose services otherwise).
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
