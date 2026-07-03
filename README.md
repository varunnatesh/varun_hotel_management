# 🏨 Varun Hotel Management System

<div align="center">

![Varun Hotel](https://img.shields.io/badge/Varun%20Hotel-Management%20System-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAzTDIgMjFoMjBMMTIgM3oiLz48L3N2Zz4=)

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-varun--hotel--management.vercel.app-22c55e?style=for-the-badge)](https://varun-hotel-management.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-varunnatesh%2Fvarun__hotel__management-181717?style=for-the-badge&logo=github)](https://github.com/varunnatesh/varun_hotel_management)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)

**A full-stack, real-time hotel operations platform — managing everything from kitchen orders to cashier billing across 7 staff roles.**

[🌐 Live App](https://varun-hotel-management.vercel.app) · [📋 Features](#-features) · [🏗️ Architecture](#️-system-architecture) · [🚀 Tech Stack](#-tech-stack) · [📦 Setup](#-local-development)

</div>

---

## 📸 Overview

Varun Hotel Management System is a **production-grade, real-time** hotel operations platform built for Indian restaurants and hotels. It handles the complete order lifecycle — from a captain seating guests, to kitchen display, to cashier billing and owner analytics — with live updates across all connected devices simultaneously.

---

## ✨ Features

### 👔 Supervisor Panel
- Real-time kitchen order display (KDS) — accept orders, mark prepared
- Discount approval workflow
- Dish-wise cancellation with filtering panel
- Active orders grouped by table

### 👨‍✈️ Captain Panel
- Interactive table map — seat guests, assign tables
- Round-wise ordering (multiple rounds per table session)
- Dish-wise serve confirmation per round
- Bill request to cashier
- Only shows **occupied tables** assigned to that captain

### 🍳 Kitchen Display System (KDS)
- Live 3-column board: **New Orders → Preparing → Ready**
- **Dish-wise checkboxes** — chef ticks off each dish as plated
- "Mark Ready" only activates when ALL dishes are checked
- Urgent order alerts (>20 min)
- Real-time via WebSocket + 3s polling fallback

### 💳 Cashier Hub
- Visual table floor plan with live status (Free / Occupied / Ready / Bill Due)
- One consolidated bill per table (all rounds merged)
- Cash / UPI / Card payment methods with change calculation
- Auto-heal for duplicate payment edge cases
- **Thermal receipt printer** — popup print window (no browser headers/footers)
- Today's revenue dashboard

### 🏪 Store Manager
- Inventory tracking and material management
- Purchase request workflow with approval routing
- Waste log tracking

### 📊 Owner Dashboard
- Real-time live orders grouped by table
- Revenue reports with date range filtering
- Staff audit log
- Menu management (CRUD)
- Expense tracking
- Health score metrics

### 🔐 Auth & Roles
- Role-based access control (RBAC) — 7 roles: `owner`, `supervisor`, `captain`, `cashier`, `kitchen`, `store`, `manager`
- Each role sees only their own dashboard
- Supabase Auth with email/password

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React SPA)                      │
│                                                                       │
│  Captain │ Kitchen │ Cashier │ Supervisor │ Owner │ Store │ Manager  │
│     ↓         ↓        ↓          ↓          ↓       ↓        ↓     │
│                   React Router v7 (Client-side routing)               │
│                   Zustand (Global state: auth + theme)                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VERCEL EDGE NETWORK                             │
│                     (Global Load Balancer)                           │
│                                                                       │
│  • 30+ Edge Regions worldwide (CDN + SSL termination)                │
│  • Automatic HTTPS / TLS 1.3                                         │
│  • Zero-config DDoS protection                                       │
│  • Instant cache invalidation on each git push                       │
│  • Static assets served from nearest CDN node                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ REST + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPABASE PLATFORM                             │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   PostgREST     │  │  Supabase        │  │  Supabase Auth   │   │
│  │  (Auto REST API)│  │  Realtime        │  │  (JWT + RLS)     │   │
│  │                 │  │  (Message Queue) │  │                  │   │
│  │  • CRUD on all  │  │  • WebSocket hub │  │  • Email/Pass    │   │
│  │    tables via   │  │  • Pub/Sub       │  │  • Role claims   │   │
│  │    HTTP REST    │  │  • Postgres      │  │    in JWT        │   │
│  │  • Auto-gen'd   │  │    LISTEN/NOTIFY │  │  • RLS policies  │   │
│  │    from schema  │  │  • Broadcasts    │  │                  │   │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                    │                       │             │
│           └────────────────────┼───────────────────────┘             │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  PostgreSQL 15 Database                      │    │
│  │                                                               │    │
│  │  orders  │  order_items  │  menu_items  │  payments          │    │
│  │  tables  │  users        │  materials   │  waste_logs        │    │
│  │  alerts  │  expenses     │  discounts   │  staff_logs        │    │
│  │                                                               │    │
│  │  • Row Level Security (RLS) on all tables                    │    │
│  │  • Postgres triggers for updated_at timestamps               │    │
│  │  • ENUM types for status fields                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📨 Message Queue (Real-time Pub/Sub)

The system uses **Supabase Realtime** as its message queue — built on PostgreSQL's native `LISTEN/NOTIFY` mechanism.

### How it works

```
Database Write (INSERT/UPDATE)
        │
        ▼
PostgreSQL WAL (Write-Ahead Log)
        │
        ▼
Supabase Realtime Server
  (Elixir Phoenix + WebSockets)
        │
        ├──→ Kitchen Display (subscribed to orders table)
        ├──→ Captain App (subscribed to orders table)
        ├──→ Cashier Hub (subscribed to orders + alerts tables)
        └──→ Supervisor (subscribed to orders table)
```

### Channels used

| Channel | Listens to | Consumers |
|---------|-----------|-----------|
| `live-orders-kds` | `orders` table — any event | Kitchen Display |
| `captain-tables-v3` | `orders` table — any event | Captain Tables |
| `cashier-hub-v3` | `orders` + `alerts` + `payments` | Cashier Billing |
| `supervisor-main` | `orders` + `discounts` | Supervisor Dashboard |

### Why this is a Message Queue pattern

- **Publisher**: Any staff role (e.g., captain places an order → INSERT into `orders`)
- **Broker**: Supabase Realtime server buffers and routes messages
- **Subscribers**: Kitchen, cashier, supervisor — each subscribes to relevant events
- **Decoupled**: Publisher doesn't know who's listening; consumers process independently

---

## ⚡ Caching Strategy

The system implements a **multi-layer caching** approach:

### Layer 1 — React State (In-Memory Cache)
```
Supabase Query → useState([]) → UI Render
                     ↑
              Cache lives here
              (component lifetime)
```
- All fetched data held in React `useState`
- Re-renders only when data changes (React diffing)
- Survives navigation within the same session

### Layer 2 — Polling Fallback Cache

Each page implements a **dual-mode refresh** strategy:

```typescript
// Realtime (instant) — fires on DB change via WebSocket
supabase.channel('cashier-hub-v3')
  .on('postgres_changes', { table: 'orders' }, loadSessions)
  .subscribe();

// Polling fallback — fires every 5s if WebSocket drops
const poll = setInterval(loadSessions, 5_000);
```

| Page | WebSocket | Poll Interval |
|------|-----------|--------------|
| Kitchen Display | ✅ | 3 seconds |
| Captain Tables | ✅ | 5 seconds |
| Cashier Billing | ✅ | 5 seconds |
| Supervisor Dashboard | ✅ | 5 seconds |
| Captain TableOrder | ✅ | 5 seconds |

### Layer 3 — Vercel CDN (Static Asset Cache)
- All JS, CSS, images served from nearest Vercel edge node
- Cache-Control headers with content-hash filenames (`index-k9H4VhBt.js`)
- Immutable caching — browser never re-downloads unchanged assets
- New deploy = new hash = instant cache bust globally

### Layer 4 — Supabase Connection Pool
- PostgREST maintains a **PgBouncer** connection pool
- Handles concurrent requests from all staff devices
- Prevents DB connection exhaustion under load

---

## ⚖️ Load Balancing

### Vercel Edge Network (Frontend)

```
User Request (India)
       │
       ▼
Vercel Edge — Mumbai / Singapore (nearest)
       │
       ├─ Static assets → CDN cache (0ms DB hit)
       └─ API calls → Supabase
```

- **30+ global edge regions** — requests routed to nearest node
- Automatic **SSL termination** at edge
- Built-in **DDoS protection**
- Zero-downtime deploys — traffic switches atomically on deploy

### Supabase Load Balancing (Backend)

```
API Requests
     │
     ▼
Supabase API Gateway (Kong)
     │
     ├──→ PostgREST (REST API layer)
     ├──→ Realtime Server (WebSocket layer)
     └──→ Auth Server (JWT layer)
            │
            ▼
     PgBouncer (Connection Pooler)
            │
            ▼
     PostgreSQL Primary
```

- **Kong API Gateway** handles routing between REST, Realtime, Auth
- **PgBouncer** pools and reuses DB connections (transaction mode)
- Supabase manages horizontal scaling of the Realtime server

---

## 🚀 Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.x | UI framework |
| **TypeScript** | 6.x | Type safety |
| **Vite** | 8.x | Build tool + dev server |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **Framer Motion** | 12.x | Animations + transitions |
| **React Router** | 7.x | Client-side routing |
| **Zustand** | 5.x | Global state management |
| **Recharts** | 2.x | Revenue charts |
| **Lucide React** | 1.x | Icon library |
| **React Hot Toast** | 2.x | Toast notifications |
| **jsPDF** | 4.x | PDF generation |
| **react-qr-code** | 2.x | QR table codes |
| **date-fns** | 4.x | Date formatting |

### Backend (Supabase Platform)

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL 15** | Primary database |
| **PostgREST** | Auto-generated REST API from DB schema |
| **Supabase Realtime** | WebSocket pub/sub (built on Phoenix + Elixir) |
| **Supabase Auth** | JWT authentication + RBAC |
| **PgBouncer** | PostgreSQL connection pooling |
| **Kong Gateway** | API gateway + rate limiting |
| **Row Level Security** | Per-table, per-role data access policies |

### Infrastructure & DevOps

| Technology | Purpose |
|-----------|---------|
| **Vercel** | Frontend hosting + CDN + edge network |
| **GitHub** | Source control + CI/CD trigger |
| **Vercel CI/CD** | Auto-deploy on `git push` |

---

## 🗄️ Database Schema

```sql
-- Core entities
users          (id, name, email, role, created_at)
menu_items     (id, name, category, price, available)
tables         (id, table_no, capacity, section)

-- Order lifecycle
orders         (id, table_no, room_no, status, total_amount,
                order_source, created_at)
               -- status: pending → preparing → ready → served → billed → paid

order_items    (id, order_id, menu_item_id, quantity, unit_price)

-- Payments
payments       (id, order_id, amount, method, collected_by,
                change_given, timestamp)
               -- UNIQUE(order_id) — one payment per order

-- Operations
alerts         (id, type, message, metadata, is_seen, created_at)
discounts      (id, order_id, amount, reason, status, requested_by)
expenses       (id, amount, category, description, date)
staff_logs     (id, user_id, action, details, table_affected, timestamp)

-- Inventory
materials      (id, name, unit, quantity, min_threshold)
waste_logs     (id, material_id, quantity, reason, logged_by, date)
```

---

## 🔄 Order Lifecycle Flow

```
Captain                Kitchen              Cashier
   │                      │                    │
   ├─ Seat guests          │                    │
   ├─ Take order           │                    │
   ├─ Place order ─────────►                    │
   │   (status: pending)   │                    │
   │                       ├─ Accept order      │
   │                       │   (preparing)      │
   │                       ├─ Tick dishes ✓     │
   │                       ├─ Mark Ready        │
   │                       │   (ready)          │
   ├─ See dish ready        │                    │
   ├─ Serve dish            │                    │
   │   (served)             │                    │
   ├─ Request Bill ─────────────────────────────►
   │   (bill_requested)     │                    │
   │                        │                    ├─ Process payment
   │                        │                    ├─ Print receipt
   │                        │                    ├─ Mark paid
   │                        │                    │   (paid)
   └────────────────────────┴────────────────────┘
              All screens update in real-time via WebSocket
```

---

## 👥 Role-Based Access

| Role | Dashboard | Capabilities |
|------|-----------|-------------|
| `owner` | Owner Dashboard | Full access — menu, staff, reports, analytics |
| `supervisor` | Supervisor Panel | KDS view, discount approvals |
| `captain` | Captain Tables | Table management, ordering, serving |
| `cashier` | Cashier Hub | Billing, payments, floor view |
| `kitchen` | Kitchen Display | Order queue, dish-wise marking |
| `store` | Store Dashboard | Inventory, purchase requests, waste log |
| `manager` | Manager View | Reports, approvals |

---

## 📦 Local Development

### Prerequisites
- Node.js 20+
- npm 9+
- Supabase account (free tier works)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/varunnatesh/varun_hotel_management.git
cd varun_hotel_management

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create environment file
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

```bash
# 4. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for Production

```bash
npm run build
```

Output in `dist/` folder.

---

## 🌐 Deployment

### Automatic (via Vercel + GitHub)

Every push to `main` auto-deploys to production:

```bash
git add .
git commit -m "your changes"
git push origin main
# → Vercel deploys in ~2 minutes
```

### Manual Deploy Steps

1. Fork this repo
2. Import to [Vercel](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy ✅

### Post-Deploy: Supabase URL Config

Add your Vercel URL to Supabase → Authentication → URL Configuration:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**`

---

## 🔒 Security

- **`.env` is gitignored** — credentials never pushed to GitHub
- **Supabase anon key** is safe for frontend (public by design)
- **Row Level Security (RLS)** enforced at DB level — users can only access their role's data
- **JWT tokens** contain role claims — validated server-side on every request
- **HTTPS** enforced by Vercel edge (HTTP → HTTPS redirect)
- **No secrets in code** — all config via environment variables

---

## 🏗️ Project Structure

```
varun_hotel_management/
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── layout/          # AppLayout, Sidebar, TopBar
│   │   └── ui/              # Button, Input, Modal, Badge, Card
│   ├── hooks/
│   │   ├── useOrders.ts     # Live orders hook (WebSocket + polling)
│   │   ├── useMaterials.ts  # Inventory hook
│   │   └── useDashboardStats.ts
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # cn(), formatCurrency(), formatElapsed()
│   ├── pages/
│   │   ├── auth/            # Login
│   │   ├── captain/         # Tables, TableOrder
│   │   ├── cashier/         # Billing, NewOrder, Payments
│   │   ├── kitchen/         # Display (KDS), WasteLog, RequestStock
│   │   ├── owner/           # Dashboard, LiveOrders, Reports, Menu...
│   │   ├── store/           # Dashboard
│   │   └── supervisor/      # Dashboard
│   ├── store/
│   │   ├── authStore.ts     # Zustand auth state
│   │   └── themeStore.ts    # Zustand theme state
│   └── types/               # TypeScript interfaces
├── .env.example             # Environment variables template
├── .npmrc                   # npm config (legacy-peer-deps)
├── .nvmrc                   # Node version (20)
├── vercel.json              # Vercel deployment config
├── tailwind.config.js       # Tailwind theme config
├── vite.config.ts           # Vite build config
└── tsconfig.json            # TypeScript config
```

---

## 📄 License

MIT © 2026 Varun Hotel — Built with ❤️ for Indian hospitality

---

<div align="center">

**🌐 Live at [varun-hotel-management.vercel.app](https://varun-hotel-management.vercel.app)**

Made with React · Supabase · Vercel

</div>
