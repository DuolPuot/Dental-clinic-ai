# 🦷 DentalAI — Dental Clinic Management Platform

A full-stack dental clinic management system with AI-powered multi-agent workflows.

## Tech Stack

- **Backend**: Node.js 20, Express, tRPC, MongoDB Atlas, Redis (in-memory)
- **Frontend**: React 18, Vite, tRPC React Query
- **AI**: OpenAI GPT-4o (clinical decision support, triage, summaries)
- **Auth**: JWT (access + refresh tokens), bcrypt, RBAC

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your MongoDB URI, JWT secrets, etc.

# 3. Seed demo data
npm run seed --prefix apps/api

# 4. Start both servers
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

## Demo Accounts (after seeding)

| Role         | Email                    | Password   |
|--------------|--------------------------|------------|
| Admin        | admin@demo.com           | Demo@1234  |
| Dentist      | dentist@demo.com         | Demo@1234  |
| Receptionist | receptionist@demo.com    | Demo@1234  |
| Billing      | billing@demo.com         | Demo@1234  |
| Dr. Duol     | dr.duol@demo.com         | Demo@1234  |
| Dr. Ganun    | dr.ganun@demo.com        | Demo@1234  |
| Dr. Chalew   | dr.chalew@demo.com       | Demo@1234  |
| Mrs. Tigist  | tigist@demo.com          | Demo@1234  |

## Deployment

### GitHub Actions CI

The CI pipeline (`.github/workflows/ci.yml`) runs on every push to `main`:
1. Installs dependencies
2. Lints API and Web
3. Builds both apps

### Production Deployment

Set these GitHub repository secrets for SSH deployment:
- `DEPLOY_HOST` — your server IP
- `DEPLOY_USER` — SSH username
- `DEPLOY_KEY` — SSH private key
- `JWT_ACCESS_SECRET` — min 32 chars
- `JWT_REFRESH_SECRET` — min 32 chars

Set repository variable `DEPLOY_ENABLED=true` to activate deployment.

### Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` and fill in all values.
**Never commit `.env` files.**

## Project Structure

```
dental-clinic-ai-platform/
├── apps/
│   ├── api/          # Express + tRPC backend
│   └── web/          # React + Vite frontend
├── .github/
│   └── workflows/    # CI/CD pipelines
└── docker-compose.yml
```
