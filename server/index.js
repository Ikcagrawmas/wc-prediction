// server/index.js
// Express API server — Stripe checkout, webhook, session verification
// Dev:  port 3001. Vite (port 5173) proxies /api/* here.
// Prod: serves built dist/ on PORT env var.

import express from 'express'
import { scoreMatchPredictions, rebuildUserScores } from './scoring.js'
import cors from 'cors'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync } from 'fs'

// ─── LOAD .env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const SUPABASE_URL         = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const PORT                 = process.env.PORT || 3001
const NODE_ENV             = process.env.NODE_ENV || 'development'
const IS_DEV               = NODE_ENV !== 'production'

const PRICE_ID    = process.env.STRIPE_PRICE_ID || 'price_1TQ0K4RxYrVh8wsnGEHc1cIs'
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'samwarr1993@icloud.com').toLowerCase()
const PROD_URL = 'https://wargackiperformance.com'
const DEV_URL  = 'http://localhost:5173'  // Vite is locked to 5173 via strictPort

// Validate at startup
const missing = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'VITE_SUPABASE_URL']
  .filter(k => !process.env[k])
if (missing.length) {
  console.error(`[server] ✗ Missing env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '')
const serviceClient = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : anonClient

// ─── EXPRESS ──────────────────────────────────────────────────────────────────
const app = express()

// CORS — accept any localhost port in dev (covers 5173, 5174, 3001, etc.)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true) // curl / server-to-server
    if (IS_DEV && origin.startsWith('http://localhost')) return cb(null, true)
    if (origin === PROD_URL || origin === `https://www.wargackiperformance.com`) return cb(null, true)
    console.warn('[cors] blocked origin:', origin)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// Webhook must receive raw body — register BEFORE express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook)

// All other routes use JSON body parsing
app.use(express.json())

// Safety net: /api/* routes that don't exist should return JSON 404, never HTML
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json')
  next()
})

// ─── POST /api/create-checkout-session ───────────────────────────────────────
app.post('/api/create-checkout-session', async (req, res) => {
  const { email, username } = req.body || {}

  if (!email || !username) {
    return res.status(400).json({ error: 'email and username are required' })
  }

  const cleanEmail    = email.trim().toLowerCase()
  const cleanUsername = username.trim()

  try {
    // Check if already paid
    const { data: existing } = await anonClient
      .from('users')
      .select('id, paid')
      .eq('email', cleanEmail)
      .single()

    if (existing?.paid) {
      console.log(`[checkout] already paid: ${cleanEmail}`)
      return res.json({ alreadyPaid: true })
    }

    // Insert user if not exists
    if (!existing) {
      const { error: insertErr } = await anonClient
        .from('users')
        .insert({ email: cleanEmail, username: cleanUsername, paid: false })
      if (insertErr && !insertErr.message?.includes('duplicate')) {
        console.error('[checkout] insert error:', insertErr)
        return res.status(500).json({ error: 'Failed to create user' })
      }
    }

    const baseUrl = IS_DEV ? DEV_URL : PROD_URL

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: cleanEmail,
      metadata: { email: cleanEmail, username: cleanUsername },
      success_url: `${baseUrl}/wc/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/wc?cancelled=true`,
      payment_intent_data: {
        metadata: { email: cleanEmail, username: cleanUsername },
      },
    })

    console.log(`[checkout] ✓ session created for ${cleanEmail} → ${session.id}`)
    return res.json({ url: session.url })

  } catch (err) {
    console.error('[checkout] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/verify-session ─────────────────────────────────────────────────
app.get('/api/verify-session', async (req, res) => {
  // Always respond JSON — never HTML
  res.setHeader('Content-Type', 'application/json')

  const { session_id } = req.query
  console.log(`[verify] → session_id received: ${session_id}`)

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' })
  }

  try {
    // 1. Retrieve session from Stripe
    const stripeSession = await stripe.checkout.sessions.retrieve(session_id)
    console.log(`[verify] stripe session retrieved, payment_status=${stripeSession.payment_status}`)

    if (stripeSession.payment_status !== 'paid') {
      return res.status(402).json({
        error: 'Payment not yet confirmed by Stripe',
        status: stripeSession.payment_status,
      })
    }

    // 2. Get email — check customer_details first (most reliable), then fallbacks
    const email = (
      stripeSession.customer_details?.email ||
      stripeSession.customer_email           ||
      stripeSession.metadata?.email          ||
      ''
    ).trim().toLowerCase()

    console.log(`[verify] email found: ${email}`)

    if (!email) {
      return res.status(400).json({ error: 'No email found in Stripe session' })
    }

    // 3. Find user in Supabase — retry up to 4× (insert from checkout may lag)
    let user = null
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { data, error: lookupErr } = await serviceClient
        .from('users')
        .select('id, email, username, paid')
        .eq('email', email)
        .single()

      if (data) {
        user = data
        console.log(`[verify] user found on attempt ${attempt}: ${user.email}`)
        break
      }

      console.log(`[verify] user not found (attempt ${attempt}/4)${lookupErr ? ': ' + lookupErr.message : ''}`)
      if (attempt < 4) await sleep(1000)
    }

    // 4. Create user if still not found (Stripe confirmed payment — safe to trust)
    if (!user) {
      const username = stripeSession.metadata?.username || email.split('@')[0]
      const { data: created, error: createErr } = await serviceClient
        .from('users')
        .insert({ email, username, paid: true, stripe_session_id: session_id })
        .select('id, email, username')
        .single()

      if (createErr || !created) {
        console.error('[verify] failed to create user:', createErr)
        return res.status(500).json({ error: 'Could not create user record' })
      }
      user = created
      console.log(`[verify] user created on-the-fly: ${email}`)
    }

    // 5. Mark paid + save session ID (idempotent)
    const { error: updateErr } = await serviceClient
      .from('users')
      .update({ paid: true, stripe_session_id: session_id })
      .eq('email', email)

    if (updateErr) {
      console.error('[verify] supabase update error:', updateErr.message)
    } else {
      console.log(`[verify] supabase update success: ${email} → paid=true`)
    }

    return res.json({
      userId:   user.id,
      email:    user.email,
      username: user.username,
      paid:     true,
    })

  } catch (err) {
    console.error('[verify] unexpected error:', err.message)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ─── GET /api/check-access ────────────────────────────────────────────────────
app.get('/api/check-access', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ paid: false })

  try {
    const { data: user, error } = await anonClient
      .from('users')
      .select('id, email, username, paid')
      .eq('id', user_id)
      .single()

    if (error || !user) return res.json({ paid: false })
    return res.json({ paid: user.paid, userId: user.id, email: user.email, username: user.username })
  } catch (err) {
    return res.status(500).json({ paid: false, error: err.message })
  }
})

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const email = (req.headers['x-admin-email'] || '').toLowerCase().trim()
  if (!email || email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// ─── GET /api/admin/matches ───────────────────────────────────────────────────
// Returns all group-stage matches with fully resolved team and group names.
// Uses three explicit queries + JS join — does not rely on Supabase FK relationships
// being configured in the dashboard (which may not be set up).
app.get('/api/admin/matches', requireAdmin, async (req, res) => {
  try {
    // 1. Fetch all group-stage matches
    const { data: matches, error: matchErr } = await serviceClient
      .from('matches')
      .select('id, match_number, stage, kickoff_time, venue, city, actual_home_score, actual_away_score, completed, home_team_id, away_team_id, group_id')
      .eq('stage', 'group')

    if (matchErr) throw matchErr
    if (!matches?.length) return res.json({ matches: [] })

    // 2. Fetch all teams (build id→name map)
    const { data: teams, error: teamErr } = await serviceClient
      .from('teams')
      .select('id, name')

    if (teamErr) throw teamErr

    const teamById = {}
    for (const t of (teams || [])) teamById[t.id] = t.name

    // 3. Fetch all groups (build id→name map)
    const { data: groups, error: groupErr } = await serviceClient
      .from('groups')
      .select('id, name')

    if (groupErr) throw groupErr

    const groupById = {}
    for (const g of (groups || [])) groupById[g.id] = g.name

    // 4. Join and reshape — produce flat objects the frontend can use directly
    const shaped = matches.map(m => ({
      id:                m.id,
      match_number:      m.match_number,
      kickoff_time:      m.kickoff_time,
      venue:             m.venue || null,
      city:              m.city  || null,
      completed:         m.completed || false,
      actual_home_score: m.actual_home_score,
      actual_away_score: m.actual_away_score,
      group_name:        groupById[m.group_id] || null,
      home_team_name:    teamById[m.home_team_id] || null,
      away_team_name:    teamById[m.away_team_id] || null,
    }))

    // 5. Sort: kickoff_time ASC, then match_number ASC
    shaped.sort((a, b) => {
      if (a.kickoff_time && b.kickoff_time) {
        const diff = new Date(a.kickoff_time) - new Date(b.kickoff_time)
        if (diff !== 0) return diff
      }
      return (a.match_number || 0) - (b.match_number || 0)
    })

    console.log(`[admin/matches] returning ${shaped.length} matches`)
    return res.json({ matches: shaped })
  } catch (err) {
    console.error('[admin/matches]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/admin/result ───────────────────────────────────────────────────
// Save actual match result and trigger auto-scoring for all user predictions
app.post('/api/admin/result', requireAdmin, async (req, res) => {
  const { match_id, home_score, away_score } = req.body
  const homeScore = parseInt(home_score, 10)
  const awayScore = parseInt(away_score, 10)

  if (!match_id || isNaN(homeScore) || isNaN(awayScore)) {
    return res.status(400).json({ error: 'match_id, home_score, and away_score are required' })
  }

  console.log(`[admin/result] match ${match_id}: ${homeScore}-${awayScore}`)

  try {
    // 1. Update match with actual scores and mark completed
    const { error: matchErr } = await serviceClient
      .from('matches')
      .update({
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        completed:         true,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', match_id)

    if (matchErr) throw matchErr
    console.log('[admin/result] ✓ match updated')

    // 2. Fetch all user predictions for this match
    const { data: predictions, error: predErr } = await serviceClient
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score')
      .eq('match_id', match_id)

    if (predErr) throw predErr
    console.log(`[admin/result] scoring ${predictions.length} predictions`)

    // 3. Score each prediction
    const scoreRows = scoreMatchPredictions(predictions, homeScore, awayScore)

    // 4. Upsert prediction_scores (replace any prior scoring for this match)
    if (scoreRows.length > 0) {
      const { error: scoreErr } = await serviceClient
        .from('prediction_scores')
        .upsert(scoreRows, { onConflict: 'user_id,match_id' })

      if (scoreErr) throw scoreErr
      console.log('[admin/result] ✓ prediction_scores upserted')
    }

    // 5. Rebuild aggregate score rows for all affected users
    const affectedUsers = [...new Set(predictions.map(p => p.user_id))]
    await rebuildUserScores(affectedUsers, serviceClient)
    console.log(`[admin/result] ✓ scores rebuilt for ${affectedUsers.length} users`)

    return res.json({
      success:        true,
      predictions_scored: scoreRows.length,
      score_summary:  scoreRows.reduce((acc, r) => {
        acc[r.scoring_reason] = (acc[r.scoring_reason] || 0) + 1
        return acc
      }, {}),
    })
  } catch (err) {
    console.error('[admin/result] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/leaderboard ─────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Query leaderboard view
    const { data: rows, error } = await serviceClient
      .from('leaderboard')
      .select('*')

    if (error) {
      // View may not exist yet — fall back to direct query
      console.warn('[leaderboard] view query failed, using fallback:', error.message)
      const { data: fallback, error: fbErr } = await serviceClient
        .from('users')
        .select('id, username, created_at')
        .eq('paid', true)
        .order('created_at', { ascending: true })

      if (fbErr) throw fbErr

      const result = fallback.map((u, i) => ({
        rank: i + 1,
        user_id: u.id,
        username: u.username,
        total_points: 0,
        match_points: 0,
        group_points: 0,
        knockout_points: 0,
        bonus_points: 0,
        exact_scores: 0,
        updated_at: null,
      }))
      return res.json({ leaderboard: result })
    }

    return res.json({ leaderboard: rows || [] })
  } catch (err) {
    console.error('[leaderboard]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/prize-pool ──────────────────────────────────────────────────────
app.get('/api/prize-pool', async (req, res) => {
  try {
    const { count, error } = await serviceClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('paid', true)

    if (error) throw error

    const paidUsers  = count || 0
    const totalPot   = paidUsers * 50
    const hostFee    = totalPot * 0.10
    const prizePool  = totalPot * 0.90
    const first      = prizePool * 0.65
    const second     = prizePool * 0.25
    const third      = prizePool * 0.10

    return res.json({ paidUsers, totalPot, hostFee, prizePool, first, second, third })
  } catch (err) {
    console.error('[prize-pool]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/user-score-breakdown ───────────────────────────────────────────
// Returns per-match scoring details for a user: prediction, actual, points, reason
app.get('/api/user-score-breakdown', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  try {
    // Get all prediction_scores for this user, join with matches and predictions
    const { data: scores, error: scErr } = await serviceClient
      .from('prediction_scores')
      .select('match_id, points, scoring_reason, scored_at')
      .eq('user_id', user_id)

    if (scErr) throw scErr

    // Get all predictions for this user
    const { data: preds, error: prErr } = await serviceClient
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score')
      .eq('user_id', user_id)

    if (prErr) throw prErr

    // Get all completed matches
    const { data: matches, error: mErr } = await serviceClient
      .from('matches')
      .select('id, match_number, actual_home_score, actual_away_score, home_team_id, away_team_id, completed')
      .eq('completed', true)
      .eq('stage', 'group')

    if (mErr) throw mErr

    // Get teams
    const { data: teams } = await serviceClient.from('teams').select('id, name')
    const teamById = {}
    for (const t of (teams || [])) teamById[t.id] = t.name

    // Build lookup maps
    const predByMatch = {}
    for (const p of (preds || [])) predByMatch[p.match_id] = p

    const scoreByMatch = {}
    for (const s of (scores || [])) scoreByMatch[s.match_id] = s

    // Assemble breakdown — only for completed matches
    const breakdown = (matches || []).map(m => {
      const pred  = predByMatch[m.id]
      const score = scoreByMatch[m.id]
      return {
        match_id:      m.id,
        match_number:  m.match_number,
        home_team:     teamById[m.home_team_id] || '?',
        away_team:     teamById[m.away_team_id] || '?',
        actual_home:   m.actual_home_score,
        actual_away:   m.actual_away_score,
        pred_home:     pred?.predicted_home_score ?? null,
        pred_away:     pred?.predicted_away_score ?? null,
        points:        score?.points ?? null,
        reason:        score?.scoring_reason ?? (pred ? 'pending' : 'no_prediction'),
        scored_at:     score?.scored_at ?? null,
      }
    }).sort((a, b) => a.match_number - b.match_number)

    // Summary stats
    const totalPoints   = breakdown.reduce((s, r) => s + (r.points || 0), 0)
    const exactScores   = breakdown.filter(r => r.reason === 'exact_score').length
    const correctResult = breakdown.filter(r => ['correct_result_same_gd','correct_result_diff_gd'].includes(r.reason)).length
    const partials      = breakdown.filter(r => r.reason === 'one_score_correct').length
    const wrong         = breakdown.filter(r => r.reason === 'wrong_result').length
    const pending       = breakdown.filter(r => r.points === null && r.pred_home !== null).length

    return res.json({ breakdown, summary: { totalPoints, exactScores, correctResult, partials, wrong, pending } })
  } catch (err) {
    console.error('[user-score-breakdown]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/user-stats ──────────────────────────────────────────────────────
// Quick stats summary for the predictions page header panel
app.get('/api/user-stats', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  try {
    const { data: score } = await serviceClient
      .from('scores')
      .select('match_points, total_points, exact_scores')
      .eq('user_id', user_id)
      .single()

    const { data: scoredRows } = await serviceClient
      .from('prediction_scores')
      .select('points, scoring_reason')
      .eq('user_id', user_id)

    const { count: completedCount } = await serviceClient
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('completed', true)
      .eq('stage', 'group')

    const exact    = (scoredRows || []).filter(r => r.scoring_reason === 'exact_score').length
    const correct  = (scoredRows || []).filter(r => ['correct_result_same_gd','correct_result_diff_gd'].includes(r.scoring_reason)).length
    const partial  = (scoredRows || []).filter(r => r.scoring_reason === 'one_score_correct').length
    const wrong    = (scoredRows || []).filter(r => r.scoring_reason === 'wrong_result').length

    return res.json({
      totalPoints:      score?.total_points  || 0,
      matchPoints:      score?.match_points  || 0,
      exactScores:      exact,
      correctResults:   correct,
      partialPoints:    partial,
      wrongPicks:       wrong,
      completedMatches: completedCount || 0,
      remainingMatches: Math.max(0, 72 - (completedCount || 0)),
    })
  } catch (err) {
    console.error('[user-stats]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/create-or-load-user ───────────────────────────────────────────
// Creates user if not exists, loads if already exists.
// Returns { userId, email, username, paid } regardless of paid status.
// This enables free preview access before payment.
app.post('/api/create-or-load-user', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const { email, username } = req.body || {}

  if (!email || !username) {
    return res.status(400).json({ error: 'email and username are required' })
  }

  const cleanEmail    = email.trim().toLowerCase()
  const cleanUsername = username.trim()

  // Basic validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be 3–20 characters' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, underscores' })
  }

  try {
    // Try to find existing user by email
    const { data: existing } = await anonClient
      .from('users')
      .select('id, email, username, paid')
      .eq('email', cleanEmail)
      .single()

    if (existing) {
      console.log(`[create-or-load] existing user: ${cleanEmail} paid=${existing.paid}`)
      // If username was stored incorrectly (e.g. as email), update it
      if (!existing.username || existing.username === cleanEmail || existing.username.includes('@')) {
        await anonClient
          .from('users')
          .update({ username: cleanUsername })
          .eq('id', existing.id)
        existing.username = cleanUsername
        console.log(`[create-or-load] corrected username to: ${cleanUsername}`)
      }
      return res.json({
        userId:   existing.id,
        email:    existing.email,
        username: existing.username,
        paid:     existing.paid,
      })
    }

    // Check username uniqueness before inserting
    const { data: usernameTaken } = await anonClient
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .single()

    if (usernameTaken) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' })
    }

    // Insert new user with paid=false
    const { data: created, error: insertErr } = await anonClient
      .from('users')
      .insert({ email: cleanEmail, username: cleanUsername, paid: false })
      .select('id, email, username, paid')
      .single()

    if (insertErr) {
      // Race condition: email duplicate inserted between our check and insert
      if (insertErr.code === '23505' && insertErr.message?.includes('email')) {
        const { data: retry } = await anonClient
          .from('users').select('id, email, username, paid').eq('email', cleanEmail).single()
        if (retry) return res.json({ userId: retry.id, email: retry.email, username: retry.username, paid: retry.paid })
      }
      throw insertErr
    }

    console.log(`[create-or-load] new user created: ${cleanEmail}`)
    return res.json({
      userId:   created.id,
      email:    created.email,
      username: created.username,
      paid:     created.paid,
    })
  } catch (err) {
    console.error('[create-or-load]', err.message)
    return res.status(500).json({ error: err.message || 'Server error' })
  }
})

// ─── POST /api/webhook ───────────────────────────────────────────────────────
async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log(`[webhook] event: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object
    if (s.payment_status !== 'paid') return res.json({ received: true })

    const email = (s.customer_details?.email || s.customer_email || s.metadata?.email || '').toLowerCase()
    if (!email) {
      console.error('[webhook] no email in session:', s.id)
      return res.json({ received: true })
    }

    const { data, error } = await serviceClient
      .from('users')
      .update({ paid: true, stripe_session_id: s.id })
      .eq('email', email)
      .select('email, username')
      .single()

    if (error) console.error('[webhook] update error:', error.message)
    else console.log(`[webhook] ✓ marked paid: ${data.email}`)
  }

  return res.json({ received: true })
}

// ─── STATIC / SPA (production) ────────────────────────────────────────────────
if (!IS_DEV) {
  const distPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  app.use(express.static(distPath))
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    res.sendFile(join(distPath, 'index.html'))
  })
} else {
  // In dev, any non-API route hit on Express means the request didn't go through Vite.
  // Return a helpful JSON error so it never silently returns HTML.
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: `API route not found: ${req.path}` })
    }
    res.status(200).json({
      info: 'Express dev server. Open http://localhost:5173 for the frontend.',
    })
  })
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] ✓ running on http://localhost:${PORT} (${NODE_ENV})`)
  console.log(`[server] stripe mode: ${STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'TEST ✓' : 'LIVE ⚠'}`)
  console.log(`[server] success_url base: ${IS_DEV ? DEV_URL : PROD_URL}`)
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[server] ⚠ SUPABASE_SERVICE_KEY not set — using anon key for DB writes (RLS may block updates)')
  }
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
