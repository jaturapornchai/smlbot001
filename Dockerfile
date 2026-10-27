FROM node:24-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3400

# Install docker-cli so SML Bot can orchestrate Agent Zero containers directly
RUN apk add --no-cache docker-cli curl

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Persistent data directory
VOLUME ["/app/data"]

EXPOSE 3400

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:3400/ || exit 1

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=3400 exec node server.js"]
