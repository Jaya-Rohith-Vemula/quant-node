# QuantNode

A modern, high-performance backtesting dashboard for quant trading strategies. Built with React, TypeScript, and Node.js (Serverless), connecting to market data in Oracle Cloud (OCI).

## Project Structure

- `/backend`: Node.js serverless functions (Vercel) for strategy computation and OCI data retrieval.
- `/frontend`: Vite + React + Tailwind CSS dashboard with interactive parameter controls and visualization.

## Setup & Local Development

### Backend
1. `cd backend`
2. `npm install`
3. Run with Vercel CLI: `vercel dev` (This will start the API on port 3000)

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev` (This will start the UI on port 5173, proxying API calls to backend)

## Deployment

This project is designed to be deployed as two separate projects:
1. **Frontend**: Point to the `frontend` directory.
2. **Backend**: Point to the `backend` directory.

Ensure the following Environment Variables are set in Vercel:
- `DB_USER`
- `DB_PASSWORD`
- `DB_CONNECT_STRING`
- `TNS_ADMIN` (points to the Wallet directory)
- `DOMAIN`
