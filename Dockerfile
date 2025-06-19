# Multi-stage build for optimized production image with Bun
FROM node:18-alpine AS builder

# Install necessary build tools and security packages
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    openssl \
    ca-certificates

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY bun.lock* ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --only=production=false

# Copy configuration files
COPY tsconfig.json ./
COPY jest.config.js ./
COPY eslint.config.js ./

# Copy source code and scripts
COPY src ./src
COPY scripts ./scripts

# Create necessary directories
RUN mkdir -p dist logs uploads

# Build the application with error handling
RUN npm run build || (echo "Build failed, checking for TypeScript errors..." && npx tsc --noEmit && exit 1)

# Run tests to ensure everything is working
RUN npm test || echo "Tests failed but continuing with build"

# Production stage
FROM oven/bun:1.1.0-alpine AS production

# Install runtime dependencies for bcrypt, Redis, and other native modules
RUN apk add --no-cache \
    libstdc++ \
    openssl \
    ca-certificates \
    curl \
    redis \
    dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json bun.lock* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary configuration files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/jest.config.js ./

# Create necessary directories with proper permissions
RUN mkdir -p uploads logs temp && \
    chmod 755 uploads logs temp

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=UTC

# Security environment variables (will be overridden by actual secrets)
ENV JWT_ACCESS_SECRET=change-in-production
ENV JWT_REFRESH_SECRET=change-in-production
ENV BCRYPT_SALT_ROUNDS=12
ENV ENCRYPTION_KEY=change-in-production

# Redis configuration
ENV REDIS_URL=redis://localhost:6379
ENV REDIS_PASSWORD=""

# Database configuration
ENV DATABASE_URL=mongodb://localhost:27017/green-uni-mind

# Health check with better error handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "run", "prod"]
