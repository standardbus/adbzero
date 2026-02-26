import { z } from 'zod'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales'
import type {
  BuildCmsArticleTransferInput,
  CmsArticleTransferContentPatch,
  CmsArticleTransferEditorState,
  CmsArticleTransferMergeResult,
  CmsArticleTransferMode,
  CmsArticleTransferTranslationPatch,
  CmsArticleTransferV1
} from '@/types/cms-transfer'
import { CMS_ARTICLE_TRANSFER_SCHEMA_VERSION } from '@/types/cms-transfer'

const ARTICLE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TAXONOMY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_IMPORT_TEXT_LENGTH = 5 * 1024 * 1024

const jsonObjectSchema = z.record(z.string(), z.unknown())
const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid datetime' })
  .transform((value) => new Date(value).toISOString())

const contentPatchSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(1).max(180).regex(ARTICLE_SLUG_REGEX).optional(),
  content_type: z.enum(['page', 'news', 'tutorial']).optional(),
  visibility: z.enum(['public', 'authenticated', 'admin_private']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publish_at: z.union([isoDateTimeSchema, z.null()]).optional(),
  is_homepage: z.boolean().optional(),
  featured_media_id: z.string().uuid().nullable().optional(),
  taxonomy_slugs: z.array(z.string().trim().min(1).max(120).regex(TAXONOMY_SLUG_REGEX)).max(300).optional()
}).strict()

const translationPatchSchema = z.object({
  title: z.string().max(2000).optional(),
  excerpt: z.string().max(3000).nullable().optional(),
  body_html: z.string().max(4_000_000).optional(),
  body_json: jsonObjectSchema.nullable().optional(),
  seo_title: z.string().max(2000).nullable().optional(),
  seo_description: z.string().max(4000).nullable().optional(),
  seo_keywords: z.string().max(4000).nullable().optional(),
  seo_canonical_url: z.string().max(4000).nullable().optional(),
  og_title: z.string().max(2000).nullable().optional(),
  og_description: z.string().max(4000).nullable().optional(),
  og_image_media_id: z.string().uuid().nullable().optional(),
  twitter_title: z.string().max(2000).nullable().optional(),
  twitter_description: z.string().max(4000).nullable().optional(),
  ai_summary: z.string().max(8000).nullable().optional(),
  json_ld: jsonObjectSchema.nullable().optional(),
}).strict()

const translationsShape = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((lang) => [lang, translationPatchSchema.optional()])
) as Record<SupportedLanguage, z.ZodOptional<typeof translationPatchSchema>>

const transferSchema = z.object({
  schema_version: z.literal(CMS_ARTICLE_TRANSFER_SCHEMA_VERSION),
  exported_at: isoDateTimeSchema,
  source: z.object({
    app: z.string().trim().min(1).max(100),
    mode: z.enum(['text', 'optimized']),
    version: z.string().trim().max(100).optional(),
  }).strict(),
  content: contentPatchSchema,
  translations: z.object(translationsShape).strict(),
}).strict()

function formatZodIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid transfer payload.'
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}

function hasOwn<T extends object>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function parseJsonObjectText(input: string): Record<string, unknown> | null {
  const value = input.trim()
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeNullableUuid(input: string): string | null {
  const value = input.trim()
  return value ? value : null
}

export function buildCmsArticleTransferFromDraft(
  input: BuildCmsArticleTransferInput,
  mode: CmsArticleTransferMode = 'text'
): CmsArticleTransferV1 {
  const translations = {} as CmsArticleTransferV1['translations']

  for (const language of SUPPORTED_LANGUAGES) {
    const draft = input.translations[language]
    translations[language] = {
      title: draft.title,
      excerpt: draft.excerpt,
      body_html: draft.bodyHtml,
      body_json: draft.bodyJson || null,
      seo_title: draft.seoTitle,
      seo_description: draft.seoDescription,
      seo_keywords: draft.seoKeywords,
      seo_canonical_url: draft.seoCanonicalUrl,
      og_title: draft.ogTitle,
      og_description: draft.ogDescription,
      og_image_media_id: normalizeNullableUuid(draft.ogImageMediaId),
      twitter_title: draft.twitterTitle,
      twitter_description: draft.twitterDescription,
      ai_summary: draft.aiSummary,
      json_ld: parseJsonObjectText(draft.jsonLdText),
    }
  }

  const payload: CmsArticleTransferV1 = {
    schema_version: CMS_ARTICLE_TRANSFER_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    source: {
      app: 'adbzero-cms',
      mode,
      version: 'v1',
    },
    content: {
      id: input.id ?? null,
      slug: input.content.slug,
      content_type: input.content.content_type,
      visibility: input.content.visibility,
      status: input.content.status,
      publish_at: input.content.publish_at,
      is_homepage: input.content.is_homepage,
      featured_media_id: input.content.featured_media_id,
      taxonomy_slugs: [...input.taxonomySlugs],
    },
    translations,
  }

  const parsed = transferSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(formatZodIssue(parsed.error))
  }
  return parsed.data
}

export function serializeCmsArticleTransfer(
  payload: CmsArticleTransferV1,
  mode: CmsArticleTransferMode
): string {
  const validatedResult = transferSchema.safeParse({
    ...payload,
    source: {
      ...payload.source,
      mode,
    },
  })
  if (!validatedResult.success) {
    throw new Error(formatZodIssue(validatedResult.error))
  }
  const validated = validatedResult.data

  return mode === 'optimized'
    ? JSON.stringify(validated)
    : JSON.stringify(validated, null, 2)
}

export type CmsArticleTransferParseErrorCode =
  | 'invalid_json'
  | 'unsupported_version'
  | 'invalid_schema'
  | 'file_too_large'

export class CmsArticleTransferParseError extends Error {
  code: CmsArticleTransferParseErrorCode

  constructor(code: CmsArticleTransferParseErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'CmsArticleTransferParseError'
  }
}

export function parseCmsArticleTransfer(text: string): CmsArticleTransferV1 {
  if (text.length > MAX_IMPORT_TEXT_LENGTH) {
    throw new CmsArticleTransferParseError('file_too_large', 'Import file is too large.')
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new CmsArticleTransferParseError('invalid_json', 'Invalid JSON file.')
  }

  const maybeVersion = (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    hasOwn(raw as Record<string, unknown>, 'schema_version')
  )
    ? (raw as Record<string, unknown>).schema_version
    : null

  if (maybeVersion !== CMS_ARTICLE_TRANSFER_SCHEMA_VERSION) {
    throw new CmsArticleTransferParseError(
      'unsupported_version',
      `Unsupported schema version: ${String(maybeVersion)}`
    )
  }

  const parsed = transferSchema.safeParse(raw)
  if (!parsed.success) {
    const reason = formatZodIssue(parsed.error)
    throw new CmsArticleTransferParseError('invalid_schema', reason)
  }

  return parsed.data
}

export function mergeCmsArticleTransferIntoEditorState(
  current: CmsArticleTransferEditorState,
  incoming: CmsArticleTransferV1
): CmsArticleTransferMergeResult {
  const warnings: string[] = []
  const nextContent = { ...current.content }
  const nextTranslations = {} as CmsArticleTransferEditorState['translations']

  for (const language of SUPPORTED_LANGUAGES) {
    nextTranslations[language] = { ...current.translations[language] }
  }

  const contentPatch = incoming.content as CmsArticleTransferContentPatch
  if (hasOwn(contentPatch, 'slug') && typeof contentPatch.slug === 'string') {
    nextContent.slug = contentPatch.slug
  }
  if (hasOwn(contentPatch, 'content_type') && contentPatch.content_type) {
    nextContent.content_type = contentPatch.content_type
  }
  if (hasOwn(contentPatch, 'visibility') && contentPatch.visibility) {
    nextContent.visibility = contentPatch.visibility
  }
  if (hasOwn(contentPatch, 'status') && contentPatch.status) {
    nextContent.status = contentPatch.status
  }
  if (hasOwn(contentPatch, 'publish_at')) {
    nextContent.publish_at = contentPatch.publish_at ?? null
  }
  if (hasOwn(contentPatch, 'is_homepage') && typeof contentPatch.is_homepage === 'boolean') {
    nextContent.is_homepage = contentPatch.is_homepage
  }
  if (hasOwn(contentPatch, 'featured_media_id')) {
    nextContent.featured_media_id = contentPatch.featured_media_id ?? null
  }

  let nextSelectedTaxonomyIds = [...current.selectedTaxonomyIds]
  if (hasOwn(contentPatch, 'taxonomy_slugs') && Array.isArray(contentPatch.taxonomy_slugs)) {
    const matched = new Set<string>()
    const unknown: string[] = []

    for (const slug of contentPatch.taxonomy_slugs) {
      const taxonomyId = current.taxonomyBySlug[slug]
      if (taxonomyId) {
        matched.add(taxonomyId)
      } else {
        unknown.push(slug)
      }
    }

    nextSelectedTaxonomyIds = Array.from(matched)
    if (unknown.length > 0) {
      warnings.push(`Unknown taxonomy slugs ignored: ${unknown.join(', ')}`)
    }
  }

  for (const language of SUPPORTED_LANGUAGES) {
    const translationPatch = incoming.translations[language] as CmsArticleTransferTranslationPatch | undefined
    if (!translationPatch) continue

    const target = { ...nextTranslations[language] }

    if (hasOwn(translationPatch, 'title') && typeof translationPatch.title === 'string') {
      target.title = translationPatch.title
    }
    if (hasOwn(translationPatch, 'excerpt')) {
      target.excerpt = translationPatch.excerpt ?? ''
    }
    if (hasOwn(translationPatch, 'body_html') && typeof translationPatch.body_html === 'string') {
      target.bodyHtml = translationPatch.body_html
    }
    if (hasOwn(translationPatch, 'body_json')) {
      target.bodyJson = translationPatch.body_json ?? null
    }
    if (hasOwn(translationPatch, 'seo_title')) {
      target.seoTitle = translationPatch.seo_title ?? ''
    }
    if (hasOwn(translationPatch, 'seo_description')) {
      target.seoDescription = translationPatch.seo_description ?? ''
    }
    if (hasOwn(translationPatch, 'seo_keywords')) {
      target.seoKeywords = translationPatch.seo_keywords ?? ''
    }
    if (hasOwn(translationPatch, 'seo_canonical_url')) {
      target.seoCanonicalUrl = translationPatch.seo_canonical_url ?? ''
    }
    if (hasOwn(translationPatch, 'og_title')) {
      target.ogTitle = translationPatch.og_title ?? ''
    }
    if (hasOwn(translationPatch, 'og_description')) {
      target.ogDescription = translationPatch.og_description ?? ''
    }
    if (hasOwn(translationPatch, 'og_image_media_id')) {
      target.ogImageMediaId = translationPatch.og_image_media_id ?? ''
    }
    if (hasOwn(translationPatch, 'twitter_title')) {
      target.twitterTitle = translationPatch.twitter_title ?? ''
    }
    if (hasOwn(translationPatch, 'twitter_description')) {
      target.twitterDescription = translationPatch.twitter_description ?? ''
    }
    if (hasOwn(translationPatch, 'ai_summary')) {
      target.aiSummary = translationPatch.ai_summary ?? ''
    }
    if (hasOwn(translationPatch, 'json_ld')) {
      target.jsonLdText = translationPatch.json_ld
        ? JSON.stringify(translationPatch.json_ld, null, 2)
        : ''
    }

    nextTranslations[language] = target
  }

  return {
    content: nextContent,
    translations: nextTranslations,
    selectedTaxonomyIds: nextSelectedTaxonomyIds,
    warnings,
  }
}
