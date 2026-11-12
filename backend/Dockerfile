FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY packages/shared-types ./packages/shared-types
COPY backend ./backend

# Install dependencies
RUN npm install

# Build shared-types and backend
RUN npm --workspace=packages/shared-types run build
RUN npm --workspace=backend run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

EXPOSE 5000

CMD ["node", "backend/dist/index.js"]
