import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@4.3.6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CMS_ALLOWED_ORIGINS = (Deno.env.get('CMS_ALLOWED_ORIGINS') ?? '').split(',').map((v) => v.trim()).filter(Boolean)
const SIGNED_URL_TTL_SECONDS = 60
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 120

const requestSchema = z.object({
  mediaId: z.string().uuid().nullable().optional(),
  storagePath: z.string().trim().min(1).max(512).nullable().optional(),
  relatedSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).nullable().optional()
}).superRefine((value, ctx) => {
  if (!value.mediaId && !value.storagePath) {
    ctx.addIssue({
      code: 'custom',
      message: 'mediaId or storagePath is required',
      path: ['mediaId']
    })
  }
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(origin, 500, { error: 'Missing Supabase env' })
  }

  if (!isAllowedOrigin(origin, referrer)) {
    return jsonResponse(origin, 403, { error: 'Origin not allowed' })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  let payloadRaw: unknown
  try {
    payloadRaw = await req.json()
  } catch {
    return jsonResponse(origin, 400, { error: 'Invalid JSON payload' })
  }
  const parsedPayload = requestSchema.safeParse(payloadRaw)
  if (!parsedPayload.success) {
    return jsonResponse(origin, 400, {
      error: 'Invalid payload',
      details: parsedPayload.error.issues[0]?.message || 'Validation failed'
    })
  }
  const payload = parsedPayload.data

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: userData } = await userClient.auth.getUser()
  const user = userData.user
  const { data: isAdminData } = await userClient.rpc('is_admin')
  const isAdmin = Boolean(isAdminData)
  const requestKey = user?.id || getRequestIp(req)
  if (isRateLimited(requestKey, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(origin, 429, { error: 'Too many requests' })
  }

  let mediaId: string | null = payload.mediaId ?? null
  let storagePath: string | null = payload.storagePath ?? null

  if (mediaId) {
    const { data: mediaRow, error: mediaError } = await serviceClient
      .from('cms_media_assets')
      .select('id,storage_path')
      .eq('id', mediaId)
      .maybeSingle()

    if (mediaError || !mediaRow?.storage_path) {
      return jsonResponse(origin, 404, { error: 'Media not found' })
    }
    if (storagePath && storagePath !== mediaRow.storage_path) {
      return jsonResponse(origin, 400, { error: 'mediaId and storagePath mismatch' })
    }
    storagePath = mediaRow.storage_path
  }

  if (!mediaId && storagePath) {
    const { data: mediaByPath, error: mediaByPathError } = await serviceClient
      .from('cms_media_assets')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle()

    if (mediaByPathError || !mediaByPath?.id) {
      return jsonResponse(origin, 404, { error: 'Media not found' })
    }
    mediaId = mediaByPath.id
  }

  if (!storagePath || !mediaId) {
    return jsonResponse(origin, 400, { error: 'Unable to resolve media asset' })
  }

  if (!isAdmin) {
    if (!payload.relatedSlug) {
      return jsonResponse(origin, 403, { error: 'Access denied' })
    }

    const { data: contentRow, error: contentError } = await serviceClient
      .from('cms_contents')
      .select('id,visibility,status,publish_at,featured_media_id')
      .eq('slug', payload.relatedSlug)
      .maybeSingle()

    if (contentError || !contentRow) {
      return jsonResponse(origin, 404, { error: 'Content not found' })
    }

    const isPublished = contentRow.status === 'published' && contentRow.publish_at && new Date(contentRow.publish_at).getTime() <= Date.now()
    if (!isPublished) {
      return jsonResponse(origin, 403, { error: 'Access denied' })
    }

    if (contentRow.visibility === 'admin_private') {
      return jsonResponse(origin, 403, { error: 'Access denied' })
    }

    if (contentRow.visibility === 'authenticated' && !user) {
      return jsonResponse(origin, 401, { error: 'Authentication required' })
    }

    const token = `cms-media://${mediaId}`
    const { data: i18nRows, error: i18nError } = await serviceClient
      .from('cms_content_i18n')
      .select('og_image_media_id,body_html')
      .eq('content_id', contentRow.id)

    if (i18nError) {
      return jsonResponse(origin, 500, { error: 'Unable to validate media usage' })
    }

    const isReferencedInContent = (
      contentRow.featured_media_id === mediaId ||
      (i18nRows || []).some((row) =>
        row.og_image_media_id === mediaId ||
        (typeof row.body_html === 'string' && row.body_html.includes(token))
      )
    )

    if (!isReferencedInContent) {
      return jsonResponse(origin, 403, { error: 'Access denied' })
    }
  }

  const { data: signed, error: signedError } = await serviceClient.storage
    .from('cms-media')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    return jsonResponse(origin, 500, { error: 'Unable to create signed URL' })
  }

  return jsonResponse(origin, 200, {
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS
  })
})
