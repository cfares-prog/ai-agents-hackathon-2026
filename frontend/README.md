# Dispatch Control Center (Frontend)

React + Vite UI for the AI Agents Hackathon dispatch pipeline — camp reports, WhatsApp linking, NGO queue, and admin health.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api`, `/health`, and `/qr` to the backend at `http://127.0.0.1:5000`.

## Backend setup

From the repo root:

```bash
cd backend
npm install
npm run seed   # demo camp + NGOs
npm start
```

Open the app at the URL Vite prints (usually http://localhost:5173).
