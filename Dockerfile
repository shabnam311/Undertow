FROM oven/bun:1.1
WORKDIR /app

# Copy all source and package definitions
COPY . .

# Install dependencies across all workspaces
RUN bun install --production

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "apps/api/src/index.ts"]