# Vazal.ai - Mac Setup Guide

Complete step-by-step guide to run vazal.ai on your Mac.

---

## Prerequisites

### 1. Install Docker Desktop for Mac
```bash
# Download from: https://www.docker.com/products/docker-desktop
# Or use Homebrew:
brew install --cask docker
```

After installation, **start Docker Desktop** from Applications.

### 2. Install Git (if not already installed)
```bash
# Check if git is installed:
git --version

# If not installed, install via Homebrew:
brew install git
```

---

## Step 1: Get the Code

### Option A: Download from Manus (Fastest)
1. Download the checkpoint: `manus-webdev://8b86cc75`
2. Extract the ZIP file
3. Open Terminal and navigate to the folder:
   ```bash
   cd ~/Downloads/vazal-ai-homepage  # adjust path as needed
   ```

### Option B: Push to GitHub first, then clone
1. Follow `GITHUB_SETUP.md` to push code to GitHub
2. Clone on your Mac:
   ```bash
   git clone https://github.com/franksiereveld/DCO2_Vazal.git
   cd DCO2_Vazal
   ```

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Create .env file
cat > .env << 'EOF'
# Database (SQLite for local testing)
DATABASE_URL=file:./local.db

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OAuth (optional for local testing)
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=your-open-id

# App Configuration
VITE_APP_TITLE=vazal.ai
VITE_APP_LOGO=/logo.svg
EOF
```

**Important:** Replace `JWT_SECRET` with a random string:
```bash
# Generate a secure JWT secret:
openssl rand -base64 32
```

---

## Step 3: Run with Docker

### Start the server:
```bash
docker-compose up
```

**First run will take 5-10 minutes** to:
- Build the Docker image
- Install dependencies
- Set up the database

### Access the website:
Open your browser and go to:
- **http://localhost:3000**

### Test SMS Login:
1. Go to http://localhost:3000/login
2. Enter your Swiss phone number: `+41793016223`
3. Check your phone for the SMS code
4. Enter the code and login!

---

## Step 4: Access from Other Devices on Your Network

Find your Mac's local IP address:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Example output: `192.168.1.100`

Now you can access from your phone or other devices:
- **http://192.168.1.100:3000**

---

## Step 5: Test if GGA Maur Allows Port 80/443

### Find your public IP:
```bash
curl ifconfig.me
```

### Configure port forwarding on your router:
1. Open your router's admin panel (usually http://192.168.1.1)
2. Find "Port Forwarding" or "NAT" settings
3. Forward external port 80 → your Mac's IP:3000
4. Forward external port 443 → your Mac's IP:3000

### Test from outside your network:
Use your phone (turn off WiFi, use mobile data):
- Visit: `http://YOUR_PUBLIC_IP`

If it works → GGA Maur allows it!  
If it doesn't → We'll use Cloudflare Tunnel (next step)

---

## Troubleshooting

### Docker not starting:
```bash
# Check Docker is running:
docker ps

# If not, start Docker Desktop from Applications
```

### Port 3000 already in use:
```bash
# Find what's using port 3000:
lsof -i :3000

# Kill the process:
kill -9 <PID>
```

### Database errors:
```bash
# Reset the database:
rm local.db
docker-compose down
docker-compose up
```

### SMS not sending:
- Check Twilio credentials in `.env`
- Verify phone number is in E.164 format (+41...)
- Check Twilio console for error logs

---

## Next Steps

Once running on your Mac:
1. **Test everything locally**
2. **Test port forwarding** (Step 5)
3. **Set up Cloudflare Tunnel** (if port forwarding doesn't work)
4. **Deploy to your 2x3090 PC** (same process, just copy the code)

---

## Stopping the Server

```bash
# Stop with Ctrl+C in the terminal

# Or stop and remove containers:
docker-compose down
```

---

## Questions?

If you encounter any issues, check:
1. Docker Desktop is running
2. `.env` file exists and has correct values
3. Port 3000 is not in use
4. Internet connection is working (for Twilio)
