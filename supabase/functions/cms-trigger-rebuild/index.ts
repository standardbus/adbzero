import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@4.3.6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CMS_DEPLOY_WEBHOOK_URL = Deno.env.get('CMS_DEPLOY_WEBHOOK_URL') ?? ''
const CMS_DEPLOY_WEBHOOK_SECRET = Deno.env.get('CMS_DEPLOY_WEBHOOK_SECRET') ?? ''
const CMS_ALLOWED_ORIGINS = (Deno.env.get('CMS_ALLOWED_ORIGINS') ?? '').split(',').map((v) => v.trim()).filter(Boolean)
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX_REQUESTS = 10

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(120).optional()
})

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function getRequestIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (bucket.count >= limit) {
    return true
  }
  bucket.count += 1
  rateLimitBuckets.set(key, bucket)
  return false
}

function originFromReferrer(referrer: string | null): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).origin
  } catch {
    return null
  }
}

function isAllowedOrigin(origin: string | null, referrer: string | null): boolean {
  if (CMS_ALLOWED_ORIGINS.length === 0) return true
  const refOrigin = originFromReferrer(referrer)
  if (origin && CMS_ALLOWED_ORIGINS.includes(origin)) return true
  if (refOrigin && CMS_ALLOWED_ORIGINS.includes(refOrigin)) return true
  return false
}

function corsHeaders(origin: string | null): HeadersInit {
  let allowOrigin = '*'
  if (CMS_ALLOWED_ORIGINS.length > 0) {
    allowOrigin = origin && CMS_ALLOWED_ORIGINS.includes(origin) ? origin : CMS_ALLOWED_ORIGINS[0]
  } else if (origin) {
    allowOrigin = origin
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
}

function jsonResponse(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const referrer = req.headers.get('referer')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(origin, 405, { error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse(origin, 500, { error: 'Missing Supabase env' })
  }

  if (!CMS_DEPLOY_WEBHOOK_URL) {
    return jsonResponse(origin, 500, { error: 'Missing CMS_DEPLOY_WEBHOOK_URL' })
  }

  if (!isAllowedOrigin(origin, referrer)) {
    return jsonResponse(origin, 403, { error: 'Origin not allowed' })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: isAdminData, error: isAdminError } = await userClient.rpc('is_admin')
  if (isAdminError || !isAdminData) {
    return jsonResponse(origin, 403, { error: 'Admin privileges required' })
  }

  const { data: userData } = await userClient.auth.getUser()
  const rateLimitKey = userData.user?.id || getRequestIp(req)
  if (isRateLimited(rateLimitKey, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(origin, 429, { error: 'Too many requests' })
  }

  let payloadRaw: unknown = {}
  try {
    payloadRaw = await req.json()
  } catch {
    // keep empty payload
  }

  const parsedPayload = payloadSchema.safeParse(payloadRaw)
  if (!parsedPayload.success) {
    return jsonResponse(origin, 400, {
      error: 'Invalid payload',
      details: parsedPayload.error.issues[0]?.message || 'Validation failed'
    })
  }
  const reason = parsedPayload.data.reason || 'cms_update'
  const response = await fetch(CMS_DEPLOY_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(CMS_DEPLOY_WEBHOOK_SECRET ? { 'x-cms-webhook-secret': CMS_DEPLOY_WEBHOOK_SECRET } : {})
    },
    body: JSON.stringify({
      event: 'cms_rebuild',
      reason,
      timestamp: new Date().toISOString()
    })
  })

  if (!response.ok) {
    const message = await response.text()
    return jsonResponse(origin, 502, { error: 'Deploy webhook failed', details: message.slice(0, 2000) })
  }

  return jsonResponse(origin, 200, { ok: true, triggered: true })
})
