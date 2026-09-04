FROM oven/bun:1.3
WORKDIR /app

COPY . .

RUN bun install --production

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "apps/api/src/index.ts"]