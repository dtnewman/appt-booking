# Base image
FROM node:20-slim AS base
WORKDIR /app

# Dependencies
FROM base AS deps
# Install additional system dependencies if needed (e.g., for Prisma)
RUN apt-get update && apt-get install -y openssl

# Copy package files
COPY package.json package-lock.json* ./
# Install dependencies
RUN npm ci

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV development

# Create non-root user and set up permissions
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy everything needed for development
COPY . .
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run in dev mode instead (NOTE: this is not recommended for production)
CMD ["npm", "run", "dev"]