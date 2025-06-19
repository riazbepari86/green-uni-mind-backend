# Green Uni Mind Backend - Docker Setup

This document provides comprehensive instructions for running the Green Uni Mind backend using Docker.

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers

### Development Environment

```bash
# Start development environment
./docker-manage.sh dev-up

# Start with development tools (Redis Commander, Mongo Express)
./docker-manage.sh dev-tools

# View logs
./docker-manage.sh dev-logs

# Stop development environment
./docker-manage.sh dev-down
```

### Production Environment

```bash
# Copy environment template
cp .env.docker .env

# Edit .env with your production values
nano .env

# Start production environment
./docker-manage.sh prod-up

# View logs
./docker-manage.sh prod-logs

# Stop production environment
./docker-manage.sh prod-down
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `dev-up` | Start development environment |
| `dev-down` | Stop development environment |
| `dev-logs` | Show development logs |
| `dev-tools` | Start development tools |
| `build-dev` | Build development images |
| `reset-dev` | Reset development environment |
| `prod-up` | Start production environment |
| `prod-down` | Stop production environment |
| `prod-logs` | Show production logs |
| `build-prod` | Build production images |
| `reset-prod` | Reset production environment |
| `health` | Check application health |
| `cleanup` | Clean up Docker resources |

## 🔧 Configuration

### Environment Variables

Copy `.env.docker` to `.env` and configure the following:

#### Required Variables
- `JWT_ACCESS_SECRET` - JWT access token secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `ENCRYPTION_KEY` - Data encryption key
- `DATABASE_URL` - MongoDB connection string
- `REDIS_URL` - Redis connection string

#### OAuth Configuration
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` & `FACEBOOK_CLIENT_SECRET`
- `APPLE_CLIENT_ID` & `APPLE_CLIENT_SECRET`

#### External Services
- `CLOUDINARY_*` - File upload service
- `STRIPE_*` - Payment processing
- `EMAIL_*` - Email service configuration

### Security Considerations

1. **Never use default secrets in production**
2. **Use strong, randomly generated passwords**
3. **Enable Redis password protection**
4. **Configure MongoDB authentication**
5. **Use HTTPS in production**

## 🏗️ Architecture

### Services

1. **Backend API** - Node.js/Bun application
2. **MongoDB** - Primary database
3. **Redis** - Caching and session storage
4. **Nginx** - Reverse proxy (production only)

### Volumes

- `mongo_data` - MongoDB persistent storage
- `redis_data` - Redis persistent storage
- `./uploads` - File uploads
- `./logs` - Application logs

### Networks

- `green-uni-mind` - Internal network for service communication

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# Check application health
./docker-manage.sh health

# Check individual services
docker-compose ps
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# With timestamps
docker-compose logs -f -t backend
```

### Development Tools

When using `dev-tools` profile:

- **Redis Commander**: http://localhost:8081
- **Mongo Express**: http://localhost:8082 (admin/admin)

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose files
2. **Memory issues**: Increase Docker memory allocation
3. **Permission errors**: Check file ownership and permissions
4. **Build failures**: Run `docker system prune` and rebuild

### Reset Environment

```bash
# Development (safe)
./docker-manage.sh reset-dev

# Production (destructive)
./docker-manage.sh reset-prod
```

### Clean Up

```bash
# Remove unused Docker resources
./docker-manage.sh cleanup

# Complete cleanup (removes everything)
docker system prune -a --volumes
```

## 📊 Performance Optimization

### Production Optimizations

1. **Multi-stage builds** for smaller images
2. **Non-root user** for security
3. **Health checks** for reliability
4. **Resource limits** in docker-compose
5. **Optimized Redis configuration**

### Scaling

```bash
# Scale backend service
docker-compose up -d --scale backend=3

# With load balancer
docker-compose --profile production up -d
```

## 🔐 Security Features

- Non-root container execution
- Minimal base images (Alpine Linux)
- Security headers and middleware
- Encrypted data transmission
- Redis and MongoDB authentication
- Network isolation

## 📝 Maintenance

### Backup

```bash
# MongoDB backup
docker exec mongo mongodump --out /backup

# Redis backup
docker exec redis redis-cli BGSAVE
```

### Updates

```bash
# Update images
docker-compose pull

# Rebuild and restart
./docker-manage.sh build-prod
./docker-manage.sh prod-up
```

## 🆘 Support

For issues and questions:

1. Check logs: `./docker-manage.sh prod-logs`
2. Verify health: `./docker-manage.sh health`
3. Review configuration in `.env`
4. Check Docker resources: `docker system df`

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [MongoDB Docker Hub](https://hub.docker.com/_/mongo)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
