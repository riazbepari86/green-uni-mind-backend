# Multi-stage build for optimized production image with Bun
FROM node:18-alpine AS builder

# Install necessary build tools
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY bun.lock* ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --only=production=false

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Create dist directory
RUN mkdir -p dist

# Build the application with error handling
RUN npm run build || (echo "Build failed, checking for TypeScript errors..." && npx tsc --noEmit && exit 1)

# Production stage
FROM oven/bun:1.1.0-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json bun.lock* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "require('http').get('http://localhost:5000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["bun", "run", "prod"]
