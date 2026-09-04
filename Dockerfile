FROM oven/bun:1.1.20-alpine
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN bun install --frozen-lockfile || bun install
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
CMD ["bun", "run", "apps/api/src/index.ts"]