FROM oven/bun:1.3-alpine AS builder

WORKDIR /build

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src src
COPY tsconfig.json .

FROM oven/bun:1.3-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /build/node_modules node_modules
COPY --from=builder /build/src src
COPY --from=builder /build/package.json .
COPY --from=builder /build/tsconfig.json .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
