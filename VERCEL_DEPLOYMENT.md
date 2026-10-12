# Vercel Deployment Guide for Lomely

Lomely is configured to deploy smoothly on **Vercel**. Follow these quick steps to get Lomely live:

---

## 1. Prerequisites
1. A **Vercel Account** ([vercel.com](https://vercel.com))
2. A **PostgreSQL Database** (Free on [Neon](https://neon.tech), [Supabase](https://supabase.com), or Vercel Postgres)
3. A **WebSocket Server** for real-time room sync & WebRTC signaling (Free on [Render](https://render.com) or [Railway](https://railway.app) by deploying `server.js`)

---

## 2. Setting Up Environment Variables on Vercel

In your Vercel Project Settings > **Environment Variables**, add:

| Key | Example Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@ep-xyz.neon.tech/lomely?sslmode=require` | PostgreSQL connection string |
| `JWT_SECRET` | `your-secure-random-secret-key-32-chars` | Used to sign session JWTs |
| `NEXT_PUBLIC_APP_URL` | `https://your-lomely-app.vercel.app` | Your Vercel domain |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-lomely-socket.onrender.com` | Real-time WebSocket server URL |

---

## 3. Database Schema Setup

Once your `DATABASE_URL` is set, push the Prisma schema to your remote database:
```bash
# Push schema to PostgreSQL
DATABASE_URL="your-postgres-url" npx prisma db push

# Optional: seed initial admin account and demo room
DATABASE_URL="your-postgres-url" node prisma/seed.js
```

> **Note**: Our build script automatically detects if `DATABASE_URL` is PostgreSQL or SQLite via [`scripts/switch-db.js`](file:///home/n30/Documents/Codes/Lomely/scripts/switch-db.js), so zero manual schema edits are needed.

---

## 4. Deploying the Real-Time WebSocket Server (Render / Railway)

Because Vercel serverless functions do not keep persistent TCP WebSockets open indefinitely, the included [`server.js`](file:///home/n30/Documents/Codes/Lomely/server.js) can be deployed in 2 clicks on a free container service like Render or Railway:

### On Render (Free Web Service):
1. Create a new **Web Service** pointing to your Lomely repository.
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Copy your Render URL (e.g. `https://lomely-socket.onrender.com`) and paste it as `NEXT_PUBLIC_SOCKET_URL` in your Vercel environment variables.

---

## 5. Deploying on Vercel

1. Push your code to GitHub / GitLab.
2. Import the project in Vercel.
3. Vercel will automatically detect Next.js and run:
   ```bash
   node scripts/switch-db.js && prisma generate && next build
   ```
4. Click **Deploy**. Your Lomely platform will be live!
