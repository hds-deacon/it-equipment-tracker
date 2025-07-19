# Deployment Guide

## Quick Start (Development)

1. **Clone the repository**
```bash
git clone https://github.com/hds-deacon/it-equipment-tracker.git
cd it-equipment-tracker
```

2. **Install dependencies**
```bash
npm install
cd client && npm install && cd ..
```

3. **Initialize database**
```bash
node scripts/init-database.js
```

4. **Start the application**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
npm run client
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Login: admin@company.com / admin123

## Production Deployment

### Prerequisites
- Node.js 16 or higher
- npm or yarn
- Reverse proxy (nginx recommended)
- SSL certificate for HTTPS

### Steps

1. **Server Setup**
```bash
# Clone repository
git clone https://github.com/hds-deacon/it-equipment-tracker.git
cd it-equipment-tracker

# Install dependencies
npm install
cd client && npm install && cd ..

# Build frontend
cd client && npm run build && cd ..
```

2. **Environment Configuration**
```bash
# Create production environment file
cp .env .env.production

# Edit .env.production
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-production-secret-key-here
CLIENT_URL=https://your-domain.com
```

3. **Database Setup**
```bash
# Initialize database
node scripts/init-database.js

# Set proper permissions
chmod 644 database/equipment_tracker.db
```

4. **Process Management (PM2)**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

5. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Serve static files
    location / {
        root /path/to/it-equipment-tracker/client/build;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads
    location /uploads {
        alias /path/to/it-equipment-tracker/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Docker Deployment

### Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS build

# Build backend
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build frontend
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm ci --only=production
COPY client/ ./
RUN npm run build

# Final stage
FROM node:18-alpine
WORKDIR /app

# Copy backend
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/client/build ./client/build
COPY . .

# Initialize database
RUN node scripts/init-database.js

EXPOSE 3001
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  it-equipment-tracker:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./database:/app/database
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-super-secure-production-secret-key-here
      - CLIENT_URL=https://your-domain.com
    restart: unless-stopped
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 3001 |
| JWT_SECRET | JWT signing secret | (required) |
| CLIENT_URL | Frontend URL | http://localhost:3000 |

## Security Checklist

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET
- [ ] Configure HTTPS
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Regular database backups
- [ ] Update dependencies regularly
- [ ] Monitor logs for security issues

## Backup Strategy

### Database Backup
```bash
# Manual backup
cp database/equipment_tracker.db backup/equipment_tracker_$(date +%Y%m%d_%H%M%S).db

# Automated backup (cron job)
0 2 * * * /path/to/backup-script.sh
```

### File Backup
```bash
# Backup uploaded files
tar -czf backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz uploads/
```

## Monitoring

### Health Check
```bash
curl -f http://localhost:3001/api/health || exit 1
```

### Log Monitoring
```bash
# PM2 logs
pm2 logs it-equipment-tracker

# System logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check file permissions
   - Verify database file exists
   - Run initialization script

2. **Frontend Build Issues**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall
   - Check Node.js version compatibility

3. **API Connection Issues**
   - Verify backend is running
   - Check environment variables
   - Confirm ports are open

4. **File Upload Issues**
   - Check uploads directory permissions
   - Verify file size limits
   - Check available disk space

### Support

For issues and questions:
1. Check the GitHub issues page
2. Review the main README.md
3. Create a new issue with detailed information

## Updates

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm update
cd client && npm update && cd ..

# Rebuild frontend
cd client && npm run build && cd ..

# Restart application
pm2 restart it-equipment-tracker
```

### Database Migrations
Currently using SQLite with schema versioning. Future updates may include migration scripts in the `scripts/` directory.