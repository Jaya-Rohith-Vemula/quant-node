# 📈 Quant Node

**Quant Node** is a premium, high-performance quantitative trading backtester designed for rapid strategy iteration and deep market analysis. It leverages a modern full-stack architecture to simulate complex trading logic against historical data stored in **Oracle Autonomous Database (OCI)**.

![Architecture](https://img.shields.io/badge/Architecture-Metadata--Driven-blueviolet?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20OCI-blue?style=for-the-badge)

---

## ⚡ Core Features

- **Multi-Strategy Engine**: Seamlessly toggle between diverse quantitative strategies like **Grid Trading** and **RSI Mean Reversion**.
- **Metadata-Driven UI**: Strategy parameters and documentation are dynamically generated from a central registry, making the platform fully extensible.
- **Micro-Animation Dashboard**: A high-fidelity, interactive UI built with **Shadcn/UI**, **Lucide**, and **Framer-style** transitions.
- **OCI Integration**: Uses high-performance Oracle connections to process thousands of historical data points in milliseconds.
- **Context-Aware Documentation**: A built-in "Strategy Intel" guide that updates its logic explanations based on your current configuration.

---

## 🛠 Project Structure

- **`/frontend`**: A Vite-powered React application using TypeScript, Tailwind CSS, and Recharts for premium data visualization.
- **`/backend`**: A Node.js API layer (optimized for Vercel Serverless) that manages database pooling and strategy execution.
- **`/_shared`**: Shared strategy logic to ensure parity between simulation environments.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Oracle Instant Client (for OCI connectivity)
- Vercel CLI (optional for serverless testing)

### 2. Backend Setup
```bash
cd backend
npm install
# Ensure .env is configured with OCI credentials
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🏗 Adding New Strategies

Quant Node is built to be "plug-and-play." To add a new strategy:

1.  **Registry**: Add the strategy metadata (name, parameters, guide) to `frontend/src/strategies.ts`.
2.  **Engine**: Implement the signal logic in `backend/api/_shared/strategy.ts`.
3.  **Deploy**: The UI will automatically render the new sliders and documentation links!

---

## ☁️ Deployment

The project is optimized for **Vercel**. Deploy as two separate projects for maximum scalability:

**Required Environment Variables:**
- `DB_USER` / `DB_PASSWORD`: OCI Credentials
- `DB_CONNECT_STRING`: Your Oracle TNS string
- `TNS_ADMIN`: Path to your extracted OCI Wallet
- `DOMAIN`: Your deployment domain

---

## 🎨 Aesthetic Design
Quant Node prioritizes **Visual Excellence**. The interface uses curated color palettes (HSL), glassmorphism, and responsive layouts to provide a premium user experience that feels state-of-the-art.

