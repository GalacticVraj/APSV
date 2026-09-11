# CarbonLoop: Circular Carbon Ecosystem Tracker

CarbonLoop is a full-stack, AI-powered platform designed for the HackOut'26 "Circular Carbon Ecosystem" track. It connects waste generators with carbon-conversion facilities (biochar, biogas, composting), optimizes collection logistics, and calculates verifiable CO2 sequestration per tonne of waste diverted from landfills.

## Architecture

The project is built as a monorepo containing three core services:

1.  **Frontend (React + Vite + Tailwind + Zustand)**: A role-based dashboard for Generators, Facilities, Logistics Partners, and Admins. Features include live KPI tracking, AI chat, interactive Leaflet maps, and real-time Socket.IO notifications.
2.  **Backend API (Node.js + Express + TypeScript + PostGIS)**: Handles core business logic, geospatial querying, role-based access control, WebSocket management, and interfaces with the Python Optimizer. Data is stored in PostgreSQL with PostGIS extensions.
3.  **Optimizer Engine (Python + FastAPI)**: A high-performance microservice responsible for:
    *   **Matching Engine**: Multi-criteria weighted scoring (distance, capacity, waste-type compatibility, conversion efficiency).
    *   **Route Optimization**: Nearest-neighbor TSP heuristic with vehicle capacity and time-window constraints.
    *   **Carbon Calculation Engine**: Applies EPA WARM v15, IPCC AR6 WG3, and DEFRA 2023 methodology.

## Tech Stack
*   **Database**: PostgreSQL + PostGIS (geospatial), Redis (caching/sessions)
*   **Backend**: Node.js, Express, TypeScript, Knex.js, Socket.IO
*   **Optimizer**: Python 3, FastAPI, Pydantic, Uvicorn
*   **Frontend**: React 18, Vite, Tailwind CSS 3, Zustand, React Router, React Leaflet, Recharts

## Setup Instructions

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   PostgreSQL (with PostGIS extension installed)
*   Redis (running locally on port 6379)

### 1. Database Setup
Ensure PostgreSQL is running and PostGIS is enabled. Create a database named `carbonloop_dev`.

### 2. Environment Variables
Copy the `.env.example` file to `.env` in the `packages/backend` and `packages/frontend` and configure your database credentials, JWT secret, and API keys.
*For the AI integration to work, you must provide a valid `GROK_API_KEY` or `GEMINI_API_KEY` in the backend `.env`.*

### 3. Backend & Frontend Installation
From the root of the project:
```bash
# Install dependencies for root, backend, and frontend
npm install

# Run database migrations
npm run dev -w packages/backend -- knex migrate:latest

# Seed the database with demo data (India-specific)
npm run dev -w packages/backend -- knex seed:run
```

### 4. Optimizer Service Installation
In a separate terminal:
```bash
cd packages/optimizer
python -m venv venv
# On Windows: venv\Scripts\activate
# On Unix: source venv/bin/activate
pip install -r requirements.txt
```

### 5. Running the Application

You will need three terminal windows to run all services concurrently:

**Terminal 1: Node.js Backend API**
```bash
npm run dev -w packages/backend
# Runs on http://localhost:3001
```

**Terminal 2: Python Optimizer Service**
```bash
cd packages/optimizer
# activate venv if not already active
python -m uvicorn app.main:app --reload --port 8000
# Runs on http://localhost:8000
```

**Terminal 3: React Frontend**
```bash
npm run dev -w packages/frontend
# Runs on http://localhost:5173
```

## Demo Credentials
You can log in to the frontend using the following demo accounts (Password for all: `Demo@1234`):
*   **Generator**: `green.farms@example.in`
*   **Facility**: `biochar.karnataka@example.in`
*   **Logistics**: `logistics@greenmove.in`
*   **Admin**: `admin@carbonloop.in`

## License
MIT License
