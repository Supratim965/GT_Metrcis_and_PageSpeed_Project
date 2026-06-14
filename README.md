# Performance Audit Hub 🚀

A production-grade, GTmetrix-style full-stack website auditing platform. Users can run performance scans on up to 20 URLs concurrently, capture high-definition full-page and above-the-fold screenshots, analyze PageSpeed Insights metrics, and export enterprise-grade cover-page PDF reports.

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Zustand, Framer Motion
- **Backend**: Node.js, Express, TypeScript, Playwright, Puppeteer
- **Queueing Engine**: BullMQ + Redis (with automatic in-memory queue fallback if Redis is not configured!)
- **Database**: PostgreSQL (compatible with local Postgres or Supabase)

---

## 🏗️ Architecture

```
                                      +--------------------+
                                      |    Next.js Web     |
                                      |     Dashboard      |
                                      +---------+----------+
                                                | HTTP/SSE
                                                v
                                      +---------+----------+
                                      |   Express Server   |
                                      +----+----------+----+
                                           |          |
                      +--------------------+          +--------------------+
                      |                                                    |
                      v                                                    v
          +-----------+-----------+                            +-----------+-----------+
          |  Queue (BullMQ/Redis) |                            |   Postgres DB Client  |
          +-----------+-----------+                            +-----------+-----------+
                      |                                                    ^
                      v                                                    |
          +-----------+-----------+                                        |
          |  Audit Worker Thread  |                                        |
          +-----+-----------+-----+                                        |
                |           |                                              |
                | Playwright|                                              |
                |           +---> Load Validation & Screenshots            |
                |           |     (Desktop Full, Above, Mobile Full)       |
                |           |                                              |
                | PageSpeed |                                              |
                |           +---> Google PageSpeed API / Lighthouse Metrics |
                |                                                          |
                +----------------- Write Report Data ----------------------+
```

---

## ⚡ Quick Start (Docker Compose)

The easiest way to run the entire stack (Postgres, Redis, Backend, Frontend) is using Docker Compose:

```bash
docker-compose up --build
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend Server API**: [http://localhost:5000](http://localhost:5000)

---

## 💻 Local Manual Setup

### 1. Database Configuration
Run the schema setup in your PostgreSQL client (Supabase or local):
```sql
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  total_urls INT NOT NULL,
  completed_urls INT DEFAULT 0
);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status VARCHAR(30) NOT NULL,
  load_time_ms INT,
  response_time_ms INT,
  dom_ready_ms INT,
  desktop_perf_score NUMERIC(5,2),
  desktop_acc_score NUMERIC(5,2),
  desktop_best_prac_score NUMERIC(5,2),
  desktop_seo_score NUMERIC(5,2),
  desktop_fcp_ms INT,
  desktop_lcp_ms INT,
  desktop_cls NUMERIC(5,3),
  desktop_tbt_ms INT,
  desktop_speed_index_ms INT,
  desktop_inp_ms INT,
  mobile_perf_score NUMERIC(5,2),
  mobile_acc_score NUMERIC(5,2),
  mobile_best_prac_score NUMERIC(5,2),
  mobile_seo_score NUMERIC(5,2),
  mobile_fcp_ms INT,
  mobile_lcp_ms INT,
  mobile_cls NUMERIC(5,3),
  mobile_tbt_ms INT,
  mobile_speed_index_ms INT,
  mobile_inp_ms INT,
  screenshot_desktop_full TEXT,
  screenshot_mobile_full TEXT,
  screenshot_desktop_above TEXT,
  recommendations JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Run Backend
1. Go to the `backend` folder.
2. Create a `.env` file from `.env.example`:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/perf_audit_hub
   REDIS_URL=redis://localhost:6379
   PAGESPEED_API_KEY=your_google_pagespeed_api_key_here
   ```
3. Install dependencies and start:
   ```bash
   npm install
   npx playwright install chromium
   npm run dev
   ```

### 3. Run Frontend
1. Go to the `frontend` folder.
2. Start the development server:
   ```bash
   npm install
   npm run dev
   ```

---

## 🌐 Production Cloud Deployment Guide

### Database (Supabase Free Tier)
1. Create a free project on [Supabase](https://supabase.com).
2. Grab the connection string under settings (transaction mode pooler is recommended).
3. Paste it as `DATABASE_URL` in your backend environment variables.

### Redis (Upstash Free Tier)
1. Spin up a free serverless Redis cluster on [Upstash](https://upstash.com).
2. Paste the `redis://...` URL string as your `REDIS_URL`.

### Backend Engine (Render or Railway)
1. Deploy the `/backend` subdirectory to Render or Railway.
2. Set the Environment Variables (`DATABASE_URL`, `REDIS_URL`, `PAGESPEED_API_KEY`).
3. If deploying to **Railway**, it will automatically detect the `Dockerfile` and provision Chrome dependencies.
4. If deploying to **Render**, use the Docker environment setting to build the project via `Dockerfile`.

### Frontend Dashboard (Vercel)
1. Connect Vercel to your Github Repository.
2. Specify `/frontend` as the root directory.
3. Configure `NEXT_PUBLIC_BACKEND_URL` to point to your deployed backend URL.
4. Click Deploy!
