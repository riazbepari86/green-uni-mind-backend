#!/bin/bash

# Docker Test Script for Green Uni Mind Backend
# This script helps you test the Docker build locally before deploying to Render

echo "🐳 Testing Docker build for Green Uni Mind Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_status "Docker is installed"

# Check if we're in the backend directory
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found. Please run this script from the backend directory."
    exit 1
fi

print_status "Found Dockerfile"

# Build the Docker image
echo "🔨 Building Docker image with Bun..."
if docker build -t green-uni-mind-backend:test .; then
    print_status "Docker image built successfully with Bun"
else
    print_error "Docker build failed"
    exit 1
fi

# Test the Docker image
echo "🧪 Testing Docker image..."
print_warning "Starting container on port 5001 (to avoid conflicts with local development)..."

# Stop any existing test container
docker stop green-uni-mind-test 2>/dev/null || true
docker rm green-uni-mind-test 2>/dev/null || true

# Run the container
if docker run -d --name green-uni-mind-test -p 5001:5000 \
    -e NODE_ENV=production \
    -e DATABASE_URL="mongodb://localhost:27017/test" \
    green-uni-mind-backend:test; then
    print_status "Container started successfully"
else
    print_error "Failed to start container"
    exit 1
fi

# Wait for the container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Test the health endpoint
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:5001/ > /dev/null 2>&1; then
    print_status "Health check passed!"
    echo "🌐 You can test the API at: http://localhost:5001"
else
    print_warning "Health check failed, but container might still be starting..."
    echo "🔍 Check container logs with: docker logs green-uni-mind-test"
fi

# Show container status
echo "📊 Container status:"
docker ps | grep green-uni-mind-test

echo ""
echo "🎯 Next steps:"
echo "1. Test your API endpoints at http://localhost:5001"
echo "2. Check logs: docker logs green-uni-mind-test"
echo "3. Stop test container: docker stop green-uni-mind-test"
echo "4. Remove test container: docker rm green-uni-mind-test"
echo "5. If everything works, deploy to Render!"

echo ""
print_status "Docker test setup complete!"
