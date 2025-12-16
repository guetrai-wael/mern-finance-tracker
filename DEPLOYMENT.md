# Chahrity Deployment Checklist

## Pre-Deployment (Local)

### Backend
- [ ] Create `.env` from `.env.production.example`
- [ ] Fill in MongoDB Atlas connection string
- [ ] Generate strong JWT secrets (use `openssl rand -base64 32`)
- [ ] Set `FRONTEND_URL=https://chahrity.com`
- [ ] Test production build: `npm start`
- [ ] Run tests: `npm test`

### Frontend
- [ ] Set `VITE_API_URL=https://api.chahrity.com/api/v1` in Netlify env vars
- [ ] Build locally: `npm run build`
- [ ] Verify build succeeds without errors

---

## Ubuntu Server Setup

### 1. Initial Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create logs directory
mkdir -p ~/logs
```

### 2. Clone & Configure
```bash
# Clone repository
git clone <your-repo-url> ~/finance-app
cd ~/finance-app/backend

# Install dependencies
npm install --production

# Create production .env
cp .env.production.example .env
nano .env  # Fill in your values
```

### 3. Start with PM2
```bash
# Start the app
pm2 start ecosystem.config.js --env production

# Verify it's running
pm2 status
pm2 logs chahrity-api

# Enable startup on reboot
pm2 startup
pm2 save
```

---

## Cloudflare Tunnel Setup

### 1. Install cloudflared
```bash
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 2. Authenticate & Create Tunnel
```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create chahrity-api

# Configure tunnel (create ~/.cloudflared/config.yml)
```

### 3. config.yml Example
```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/ubuntu/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.chahrity.com
    service: http://localhost:4000
  - service: http_status:404
```

### 4. Route DNS & Run
```bash
# Add DNS record
cloudflared tunnel route dns chahrity-api api.chahrity.com

# Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## Netlify Frontend Setup

### Environment Variables (Netlify Dashboard)
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.chahrity.com/api/v1` |

### Build Settings
- **Build command**: `npm run build`
- **Publish directory**: `dist`

---

## Post-Deployment Verification

- [ ] API health check: `curl https://api.chahrity.com/api/v1/health`
- [ ] Frontend loads at `https://chahrity.com`
- [ ] User can register/login
- [ ] Transactions CRUD works
- [ ] Admin can activate/deactivate users
- [ ] PM2 shows healthy process: `pm2 status`
- [ ] Cloudflare tunnel is active: `systemctl status cloudflared`

---

## Maintenance Commands

```bash
# View logs
pm2 logs chahrity-api

# Restart app
pm2 restart chahrity-api

# Reload with zero downtime
pm2 reload chahrity-api

# Update code
cd ~/finance-app && git pull
npm install --production
pm2 reload chahrity-api
```
