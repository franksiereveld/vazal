# vazal.ai Deployment Guide

This guide will help you deploy the vazal.ai application on your Mac or 2x3090 PC.

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- Your Twilio credentials (Account SID, Auth Token, Phone Number)

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd vazal-ai-homepage
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=mysql://vazal:vazalpassword@db:3306/vazal

# MySQL Configuration
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=vazal
MYSQL_USER=vazal
MYSQL_PASSWORD=vazalpassword

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Twilio Configuration (get from https://console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Application Configuration
VITE_APP_ID=vazal-ai
VITE_APP_TITLE=vazal.ai - Your Personal AI Agent

# OAuth Configuration (Manus)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

**Important:** Change the `JWT_SECRET` to a random string for security.

### 3. Start the Application

```bash
docker-compose up -d
```

This will:
- Build the application Docker image
- Start a MySQL database
- Run database migrations
- Start the web server on port 3000

### 4. Access the Application

Open your browser and navigate to:
- **Local**: http://localhost:3000
- **SMS Login**: http://localhost:3000/login

## Database Management

### Run Migrations

```bash
docker-compose exec app pnpm db:push
```

### Access MySQL

```bash
docker-compose exec db mysql -u vazal -pvazalpassword vazal
```

## Stopping the Application

```bash
docker-compose down
```

To also remove the database volume:

```bash
docker-compose down -v
```

## Deployment on Mac

1. Install Docker Desktop for Mac
2. Follow the Quick Start steps above
3. Access at http://localhost:3000

## Deployment on 2x3090 PC

1. Install Docker and Docker Compose on Linux
2. Follow the Quick Start steps above
3. Access at http://<your-pc-ip>:3000

### Expose to Network

To access from other devices on your network, the application is already exposed on port 3000. Just use your PC's IP address.

## Custom Domain Setup (vazal.ai)

To use your vazal.ai domain:

1. **Point DNS to your server**:
   - Add an A record: `vazal.ai` → `<your-server-ip>`
   - Add an A record: `www.vazal.ai` → `<your-server-ip>`

2. **Set up reverse proxy** (Nginx example):

```nginx
server {
    listen 80;
    server_name vazal.ai www.vazal.ai;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **Add SSL with Let's Encrypt**:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d vazal.ai -d www.vazal.ai
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Change 8080 to any available port
```

### Database Connection Issues

Check if the database is running:

```bash
docker-compose ps
docker-compose logs db
```

### SMS Not Sending

Verify your Twilio credentials in the `.env` file and check logs:

```bash
docker-compose logs app
```

## Development Mode

To run in development mode with hot reload:

```bash
pnpm install
pnpm dev
```

Access at http://localhost:3000

## Production Considerations

1. **Change JWT_SECRET** to a strong random string
2. **Use strong MySQL passwords**
3. **Enable HTTPS** with SSL certificates
4. **Set up backups** for the MySQL database
5. **Monitor logs** for errors
6. **Keep Docker images updated**

## Support

For issues or questions, contact: [your-email]
