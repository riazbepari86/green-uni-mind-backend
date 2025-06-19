#!/bin/bash

# Green Uni Mind Backend Docker Management Script
# This script helps manage Docker containers for development and production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if .env file exists
check_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from .env.docker template..."
        cp .env.docker .env
        print_warning "Please edit .env file with your actual configuration values."
    fi
}

# Development environment
dev_up() {
    print_header "Starting Development Environment"
    check_docker
    docker-compose -f docker-compose.dev.yml up -d
    print_status "Development environment started successfully!"
    print_status "Backend: http://localhost:5000"
    print_status "MongoDB: localhost:27018"
    print_status "Redis: localhost:6380"
}

dev_down() {
    print_header "Stopping Development Environment"
    docker-compose -f docker-compose.dev.yml down
    print_status "Development environment stopped."
}

dev_logs() {
    print_header "Development Environment Logs"
    docker-compose -f docker-compose.dev.yml logs -f
}

dev_tools() {
    print_header "Starting Development Tools"
    docker-compose -f docker-compose.dev.yml --profile tools up -d
    print_status "Development tools started!"
    print_status "Redis Commander: http://localhost:8081"
    print_status "Mongo Express: http://localhost:8082 (admin/admin)"
}

# Production environment
prod_up() {
    print_header "Starting Production Environment"
    check_docker
    check_env_file
    docker-compose up -d
    print_status "Production environment started successfully!"
    print_status "Backend: http://localhost:5000"
}

prod_down() {
    print_header "Stopping Production Environment"
    docker-compose down
    print_status "Production environment stopped."
}

prod_logs() {
    print_header "Production Environment Logs"
    docker-compose logs -f
}

# Build functions
build_dev() {
    print_header "Building Development Images"
    docker-compose -f docker-compose.dev.yml build --no-cache
    print_status "Development images built successfully!"
}

build_prod() {
    print_header "Building Production Images"
    docker-compose build --no-cache
    print_status "Production images built successfully!"
}

# Cleanup functions
cleanup() {
    print_header "Cleaning Up Docker Resources"
    docker system prune -f
    docker volume prune -f
    print_status "Docker cleanup completed!"
}

reset_dev() {
    print_header "Resetting Development Environment"
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.dev.yml build --no-cache
    docker-compose -f docker-compose.dev.yml up -d
    print_status "Development environment reset successfully!"
}

reset_prod() {
    print_header "Resetting Production Environment"
    print_warning "This will delete all data! Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        docker-compose down -v
        docker-compose build --no-cache
        docker-compose up -d
        print_status "Production environment reset successfully!"
    else
        print_status "Reset cancelled."
    fi
}

# Health check
health() {
    print_header "Health Check"
    echo "Checking backend health..."
    if curl -f http://localhost:5000/ > /dev/null 2>&1; then
        print_status "Backend is healthy!"
    else
        print_error "Backend is not responding!"
    fi
}

# Show help
show_help() {
    echo "Green Uni Mind Backend Docker Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Development Commands:"
    echo "  dev-up      Start development environment"
    echo "  dev-down    Stop development environment"
    echo "  dev-logs    Show development logs"
    echo "  dev-tools   Start development tools (Redis Commander, Mongo Express)"
    echo "  build-dev   Build development images"
    echo "  reset-dev   Reset development environment (removes data)"
    echo ""
    echo "Production Commands:"
    echo "  prod-up     Start production environment"
    echo "  prod-down   Stop production environment"
    echo "  prod-logs   Show production logs"
    echo "  build-prod  Build production images"
    echo "  reset-prod  Reset production environment (removes data)"
    echo ""
    echo "Utility Commands:"
    echo "  health      Check application health"
    echo "  cleanup     Clean up Docker resources"
    echo "  help        Show this help message"
}

# Main script logic
case "$1" in
    dev-up)
        dev_up
        ;;
    dev-down)
        dev_down
        ;;
    dev-logs)
        dev_logs
        ;;
    dev-tools)
        dev_tools
        ;;
    build-dev)
        build_dev
        ;;
    reset-dev)
        reset_dev
        ;;
    prod-up)
        prod_up
        ;;
    prod-down)
        prod_down
        ;;
    prod-logs)
        prod_logs
        ;;
    build-prod)
        build_prod
        ;;
    reset-prod)
        reset_prod
        ;;
    health)
        health
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
