# Lomely

> An offbeat, dark-themed platform for synchronized media streaming, spatial rooms, real-time voice & video calls, and community messaging. Built entirely on **Next.js 14**, **Socket.io**, **WebRTC**, and **Prisma ORM**.

---

## Highlights & Design Philosophy

- **Visual Direction**: Moody, architectural dark mode (obsidian `#08080a`, deep graphite, subtle hairline borders) accented with industrial amber (`#f59e0b`) and cold titanium.
- **Zero Cheap AI Clichés**: Strictly no emojis and no purple throughout the interface. Clean geometric SVG iconography ([`lucide-react`](https://lucide.dev)) and standard typography (`Inter`).
- **Interactive Spatial Depth**: Figma-grade layered cards, smooth layout transitions ([`framer-motion`](https://www.framer.com/motion/)), and an ambient 3D particle & architectural lattice background powered by [`Three.js`](https://threejs.org/).
- **Responsive by Design**: Fluid adaptation across desktop monitors, tablets, and mobile screens.

---

## Core Capabilities

1. **User Account & Verification System**
   - Username, email, and password authentication.
   - **Zero third-party OAuth** (no Google, Apple, or Facebook tracking).
   - Cryptographic 6-digit email OTP verification with auto-fill preview in development.
   - Secure HTTP-only JWT sessions.

2. **Synchronized Room System**
   - Unique alphanumeric room IDs (`lomely.app/room/lml-xxxx`).
   - **Public vs. Closed Rooms**:
     - *Public*: Searchable and discoverable in the room directory.
     - *Closed*: Protected and invite-only; hosts invite users directly by `@username`.
   - **YouTube Synchronized Player**:
     - Paste any YouTube video link.
     - Sub-second drift detection automatically synchronizes non-host participants.
     - Synchronized play, pause, seek, and custom audio controls.

3. **WebRTC Voice, Video & Screen Share (VC)**
   - Native peer-to-peer WebRTC mesh voice channel.
   - Microphone mute/unmute, webcam camera toggle, and desktop screen sharing.
   - Speaking indicators and audio visualizer tiles.

4. **In-Room Live Chat & Outside Messaging (DMs)**
   - Real-time in-room text chat (Google Meet / Zoom style).
   - Global 1-on-1 Direct Messaging (DMs) outside rooms with live typing indicators and unread counters.

5. **Administrator Dashboard**
   - Comprehensive platform metrics (total users, email verification rate, active rooms, message volume).
   - User directory with full email inspection, manual verification toggles, role promotions, and account deletion.
   - Room audit log with immediate force-termination capabilities.

---

## Quick Start

### 1. Installation & Setup
```bash
# Clone and enter directory
cd Lomely

# Install dependencies (already completed)
npm install

# Initialize database schema
npm run db:push

# Seed default admin & featured room
npm run db:seed
```

### 2. Development & Production Run
```bash
# Launch unified Next.js + Socket.io server
npm run dev

# Or compile and launch production build
npm run build
npm run start
```
The application will be live at `http://localhost:3000`.

---

## Default Seed Credentials

For immediate testing, the database includes pre-configured accounts:

| Role | Username | Email | Password |
|---|---|---|---|
| **Administrator** | `admin` | `admin@lomely.app` | `adminpassword123` |
| **Demo Member** | `alexander` | `alex@lomely.app` | `alexander123` |

- **Sample Featured Room**: `lml-cyber` (*Synthwave & Cyber Ambient*)
