# Dealer Scheme Portal

AI-powered B2B dealer incentive scheme management platform built on Next.js + PostgreSQL + OpenAI GPT-4o.

## Features

- **AI Scheme Builder** — describe a scheme in natural language and have GPT-4o build the rules, slabs, and bonus logic
- **Admin Portal** — manage schemes, SKUs, dealers, invoices, and run what-if simulations
- **Dealer Portal** — gamified journey/goal visualization of scheme progress, rewards across slabs, and personal incentive calculator
- **Territory Map** — India-level geographical view with per-region drill-down
- **Scheme Engine** — slab/percentage/per-unit/fixed incentive calculation with combo bonuses

## Stack

- Next.js 16 (App Router, Turbopack)
- PostgreSQL via `pg` (local or Neon serverless)
- OpenAI GPT-4o + Anthropic Claude (fallback) via `/src/lib/ai-helpers.ts`
- Recharts, Tailwind v4

## Environment variables

```
DATABASE_URL=postgres://...      # Neon connection string (SSL auto-enabled)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

If `DATABASE_URL` is unset, the app falls back to `postgres://postgres@localhost:5432/greatwhite_schemes`.

## Local development

```
npm install
npm run dev
```

Visit `http://localhost:3000`. First load triggers `/api/seed` which creates tables and seed data. For bulk test data hit `/api/seed-massive` (80 dealers + ~500 invoices).

## Deploying

1. Push to GitHub
2. Import the repo into Vercel
3. Provision a Neon Postgres database (Vercel Marketplace → Neon, or neon.tech)
4. Set `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in Vercel project env
5. First request to the deployment will seed the DB automatically
