# CarbonLoop & TERRAFLUX: Circular Carbon Ecosystem & Network Operating System

HackOut'26 · PS11 — Waste-to-Carbon Value Chain · Circular Carbon Ecosystem

---

## 1. CarbonLoop Ecosystem Tracker

CarbonLoop is a full-stack, AI-powered platform designed for the HackOut'26 "Circular Carbon Ecosystem" track. It connects waste generators with carbon-conversion facilities (biochar, biogas, composting), optimizes collection logistics, and calculates verifiable CO2 sequestration per tonne of waste diverted from landfills.

### Architecture

The project is built as a monorepo containing three core services:

1.  **Frontend (React + Vite + Tailwind + Zustand)**: A role-based dashboard for Generators, Facilities, Logistics Partners, and Admins. Features include live KPI tracking, AI chat, interactive Leaflet maps, and real-time Socket.IO notifications.
2.  **Backend API (Node.js + Express + TypeScript + PostGIS)**: Handles core business logic, geospatial querying, role-based access control, WebSocket management, and interfaces with the Python Optimizer. Data is stored in PostgreSQL with PostGIS extensions.
3.  **Optimizer Engine (Python + FastAPI)**: A high-performance microservice responsible for:
    *   **Matching Engine**: Multi-criteria weighted scoring (distance, capacity, waste-type compatibility, conversion efficiency).
    *   **Route Optimization**: Nearest-neighbor TSP heuristic with vehicle capacity and time-window constraints.
    *   **Carbon Calculation Engine**: Applies EPA WARM v15, IPCC AR6 WG3, and DEFRA 2023 methodology.

### Tech Stack
*   **Database**: PostgreSQL + PostGIS (geospatial), Redis (caching/sessions)
*   **Backend**: Node.js, Express, TypeScript, Knex.js, Socket.IO
*   **Optimizer**: Python 3, FastAPI, Pydantic, Uvicorn
*   **Frontend**: React 18, Vite, Tailwind CSS 3, Zustand, React Router, React Leaflet, Recharts

---

## 2. TERRAFLUX Network Operating System

For every available tonne of residue, TERRAFLUX decides the highest-value carbon-positive pathway: where it should go, how it should get there, how it should be processed, what carbon and economic value that creates — and what happens when conditions change.

### What it does

**Optimises.** A capacitated facility-location problem with semi-continuous throughput: a plant either runs above its minimum viable feed or does not run at all. Branch and bound over the facility on/off decisions, with each node's relaxation solved *exactly* by min-cost flow. The whole network solves in **25–180 ms**.

**Prices capacity.** For every binding facility the optimiser is re-run with one extra tonne per day of headroom and the whole network re-solved. The difference is the true marginal value of capacity — in tCO₂e *and* in rupees — including every knock-on reallocation.

**Accounts honestly.** Biogenic CO₂ is excluded. Durable removal and avoided emissions are never summed. Biochar permanence is computed from the char's H/C(org) ratio and Q10-corrected from the 14.9 °C reference dataset to Indian soil at 26 °C.

---

## Quick Start Commands

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | TERRAFLUX API & Web Client dev servers |
| `npm run dev:all` | CarbonLoop Frontend & Backend dev servers |
| `npm test` | Run backend & frontend test suites |
| `npm run test:engine` | Run TERRAFLUX engine tests |
| `npm run typecheck` | Type-checks TS packages |

