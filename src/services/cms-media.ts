import { z } from 'zod'
import slugify from 'slugify'
import { supabase } from '@/services/supabase'
import type { CmsMediaAsset, CmsMediaType } from '@/types/cms'

const MAX_SIZE: Record<CmsMediaType, number> = {
  image: 12 * 1024 * 1024,
  video: 300 * 1024 * 1024,
  audio: 80 * 1024 * 1024,
  document: 30 * 1024 * 1024,
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'application/pdf',
  'text/plain',
  'application/zip',
])

const metaSchema = z.object({
  title_i18n: z.record(z.string(), z.string().max(200)).default({}),
  alt_i18n: z.record(z.string(), z.string().max(240)).default({}),
  caption_i18n: z.record(z.string(), z.string().max(400)).default({}),
  credit_i18n: z.record(z.string(), z.string().max(200)).default({}),
})

function inferMediaType(mime: string): CmsMediaType {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

function formatHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256OfFile(file: File): Promise<string> {
  const arr = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', arr)
  return formatHex(hash)
}

function sanitizeFileName(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : ''
  const base = name.replace(/\.[^.]+$/, '')
  const slug = slugify(base, { lower: true, strict: true, trim: true }) || 'media'
  return `${slug}${ext}`
}

function validateMediaFile(file: File): { mediaType: CmsMediaType } {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported MIME type: ${file.type}`)
  }
  const mediaType = inferMediaType(file.type)
  if (file.size > MAX_SIZE[mediaType]) {
    throw new Error(`File too large for ${mediaType}`)
  }
  return { mediaType }
}

export async function listCmsMediaAssets(): Promise<CmsMediaAsset[]> {
  const { data, error } = await supabase
    .from('cms_media_assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as CmsMediaAsset[]
}

export async function uploadCmsMedia(
  file: File,
  metadataInput: z.input<typeof metaSchema>
): Promise<CmsMediaAsset> {
  const { mediaType } = validateMediaFile(file)
  const metadata = metaSchema.parse(metadataInput)
  const checksum = await sha256OfFile(file)

  const now = Date.now()
  const safeName = sanitizeFileName(file.name)
  const storagePath = `${mediaType}/${now}-${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('cms-media')
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('cms_media_assets')
    .insert({
      bucket: 'cms-media',
      storage_path: storagePath,
      media_type: mediaType,
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: checksum,
      title_i18n: metadata.title_i18n,
      alt_i18n: metadata.alt_i18n,
      caption_i18n: metadata.caption_i18n,
      credit_i18n: metadata.credit_i18n,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CmsMediaAsset
}

export async function getProtectedMediaUrl(params: {
  mediaId?: string
  storagePath?: string
  relatedSlug?: string
}): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('cms-media-access', {
    body: {
      mediaId: params.mediaId ?? null,
      storagePath: params.storagePath ?? null,
      relatedSlug: params.relatedSlug ?? null,
    },
  })
  if (error) return null
  return data?.signedUrl || null
}

export async function resolveMediaTokensInHtml(html: string, relatedSlug: string): Promise<string> {
  if (!html) return html
  const regex = /cms-media:\/\/([0-9a-fA-F-]{36})/g
  const ids = Array.from(new Set(Array.from(html.matchAll(regex)).map((m) => m[1])))
  if (ids.length === 0) return html

  let resolvedHtml = html
  for (const id of ids) {
    const signed = await getProtectedMediaUrl({
      mediaId: id,
      relatedSlug
    })
    if (signed) {
      resolvedHtml = resolvedHtml.split(`cms-media://${id}`).join(signed)
    }
  }
  return resolvedHtml
}
