FROM oven/bun:1.1.20-alpine
WORKDIR /app

# Copy all workspace manifests first
COPY package.json bun.lock* ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies across all workspaces
RUN bun install

# Copy source code
COPY packages/db ./packages/db
COPY apps/api ./apps/api

ENV NODE_ENV=production

CMD ["bun", "run", "apps/api/src/index.ts"]