# Hosting Guide — Department Inventory System

---

## Option A: Railway (Easiest — Free tier available)

### Step 1: Install Node.js first
Download from https://nodejs.org/en/download — choose **Windows Installer (LTS)**

### Step 2: Create a GitHub repository
1. Go to https://github.com and create a free account
2. Create a new repository (e.g. `dept-inventory`)
3. In your `coder/` folder, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dept-inventory.git
   git push -u origin main
   ```

### Step 3: Deploy on Railway
1. Go to https://railway.app and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js and runs `npm start`
5. Go to **Variables** tab and add:
   ```
   PORT=3000
   JWT_SECRET=<paste a 64-char random string>
   NODE_ENV=production
   DB_PATH=./data/inventory.db
   ```
6. Go to **Settings → Networking → Generate Domain**
7. Your app is live at `https://yourapp.up.railway.app`

**Important:** After first deploy, run the seed script once:
- Open Railway shell (Settings → Shell) and run: `npm run seed`

---

## Option B: Render (Also free)

1. Push code to GitHub (same as Step 1-2 above)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add Environment Variables:
   ```
   JWT_SECRET=your_64_char_random_secret
   NODE_ENV=production
   DB_PATH=./data/inventory.db
   ```
6. Click **Create Web Service**

**Note on Render free tier:** The free tier spins down after inactivity. Use a paid tier or Railway for always-on.

---

## Option C: Your own VPS / Cloud VM (AWS EC2, DigitalOcean, etc.)

### 1. Connect to your server
```bash
ssh user@your-server-ip
```

### 2. Install Node.js 20 (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Upload your project
```bash
# From your local machine:
scp -r coder/ user@your-server-ip:~/dept-inventory/
```

### 4. Install and start
```bash
cd ~/dept-inventory
npm install
cp .env.example .env
nano .env    # Set JWT_SECRET and NODE_ENV=production
npm run seed
npm start
```

### 5. Keep it running with PM2
```bash
npm install -g pm2
pm2 start server.js --name dept-inventory
pm2 startup
pm2 save
```

### 6. Expose with Nginx (optional, for custom domain + HTTPS)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
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
Then get free HTTPS with: `sudo certbot --nginx -d yourdomain.com`

---

## Option D: Local network (share with colleagues on Wi-Fi)

1. Install Node.js from https://nodejs.org
2. Open Command Prompt in the `coder/` folder:
   ```
   npm install
   npm run seed
   npm start
   ```
3. Find your local IP: run `ipconfig` → look for IPv4 Address (e.g. `192.168.1.10`)
4. Anyone on the same Wi-Fi can access: `http://192.168.1.10:3000`

---

## Production Security Checklist

- [ ] Change `JWT_SECRET` to a long random string (use: https://generate.rs/hex/64)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (handled by Railway/Render automatically, or Certbot on VPS)
- [ ] Change all default passwords immediately after seeding
- [ ] Keep `data/inventory.db` backed up regularly
- [ ] Review and update `RENEWAL_LIMIT` and `ISSUE_LIMIT` per your policy
