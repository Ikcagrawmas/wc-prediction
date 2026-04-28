# Wargacki Performance — World Cup Prediction Challenge

A full-stack World Cup prediction competition engine. Players predict group stage scores and knockout bracket results before the first whistle. Auto-scoring, live leaderboard, Stripe payments, admin results entry.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, CSS Modules |
| Backend | Node.js + Express (port 3001) |
| Database | Supabase (Postgres) |
| Payments | Stripe Checkout |
| Hosting | Any Node host (Railway, Render, Fly.io) |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/wc-prediction.git
cd wc-prediction
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role key |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → signing secret |
| `STRIPE_PRICE_ID` | Stripe Dashboard → Products → your product → price ID |
| `ADMIN_EMAIL` | Your email address for admin panel access |

### 3. Database

Run these SQL files in order in **Supabase Dashboard → SQL Editor**:

```
supabase/schema.sql           # Phase 1 — base tables
supabase/seed_tournament.sql  # Phase 2 — 48 teams, 72 matches
supabase/phase3_5_bonus.sql   # Phase 3.5 — bonus_predictions table
supabase/phase5_scoring.sql   # Phase 5 — scoring, leaderboard view
supabase/fix_usernames.sql    # Username cleanup (run once)
```

### 4. Run (development)

Both servers must run simultaneously. Open **two terminals**:

```bash
# Terminal 1 — Express API server (port 3001)
npm run server

# Terminal 2 — Vite dev server (port 5173)
npm run dev
```

Or run both in one terminal:

```bash
npm run dev:full
```

Open: http://localhost:5173

### 5. Stripe webhook (local dev)

Stripe webhooks need a public URL. Use [ngrok](https://ngrok.com):

```bash
# Terminal 3
ngrok http 3001
```

Copy the `https://....ngrok.io` URL. In **Stripe Dashboard → Developers → Webhooks → Add endpoint**:
- URL: `https://your-ngrok-url.ngrok.io/api/webhook`
- Event: `checkout.session.completed`
- Copy the signing secret → paste as `STRIPE_WEBHOOK_SECRET` in `.env`

Restart `npm run server` after updating `.env`.

### 6. Build for production

```bash
npm run build        # compiles React into dist/
npm start            # serves dist/ + API on PORT env var
```

---

## Routes

| URL | Description |
|---|---|
| `/wc` | Landing page — entry form, prize pool |
| `/wc/predictions` | Prediction form (preview free, save requires payment) |
| `/wc/payment-success` | Post-Stripe redirect, verifies payment |
| `/wc/leaderboard` | Live leaderboard + prize pool |
| `/wc/admin` | Admin results entry (protected by `ADMIN_EMAIL`) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/create-or-load-user` | Create or return existing user |
| POST | `/api/create-checkout-session` | Start Stripe Checkout |
| GET | `/api/verify-session` | Confirm payment after redirect |
| GET | `/api/check-access` | Verify user paid status |
| POST | `/api/webhook` | Stripe webhook receiver |
| GET | `/api/leaderboard` | Ranked leaderboard |
| GET | `/api/prize-pool` | Live prize pool calculation |
| GET | `/api/admin/matches` | All matches (admin only) |
| POST | `/api/admin/result` | Save result + auto-score (admin only) |
| GET | `/api/user-score-breakdown` | Per-match scoring detail |
| GET | `/api/user-stats` | Aggregate user stats |

---

## Pulling Updates

When new changes are pushed:

```bash
git pull origin main
npm install          # only needed if package.json changed
npm run build        # rebuild frontend
npm run dev:full     # or npm start in production
```

---

## Prize Pool Formula

```
totalPot   = paidUsers × $50
hostFee    = totalPot × 10%
prizePool  = totalPot × 90%
1st place  = prizePool × 65%
2nd place  = prizePool × 25%
3rd place  = prizePool × 10%
```

## Scoring

| Scenario | Points |
|---|---|
| Exact score | +5 |
| Correct result + correct goal difference | +4 |
| Correct result | +3 |
| One team's score correct | +1 |
| Wrong result | 0 |
| Round of 32 pick correct | +3 |
| Quarterfinal pick correct | +5 |
| Semifinal pick correct | +8 |
| Champion correct | +15 |

---

## Deployment Notes

- Express serves the built `dist/` in production — one process handles both frontend and API
- Set `NODE_ENV=production` and `PORT=<your port>` on your host
- Do **not** use `app.get('*', ...)` wildcard routes — use `app.use(...)` for catch-all (already done)
- Stripe must be switched from `sk_test_` to `sk_live_` before going live
- Update `PROD_URL` in `server/index.js` to match your actual domain
