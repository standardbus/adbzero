import { z } from 'zod'
import { supabase } from '@/services/supabase'
import { sanitizeCmsHtml } from '@/lib/cms-sanitize'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales'
import type {
  CmsContent,
  CmsContentI18n,
  CmsLocalizedContent,
  CmsStatus,
  CmsContentType,
  CmsVisibility,
  CmsTaxonomy,
  CmsRevision,
  CmsListResponse,
  CmsNavigationItem,
  CmsNavigationResponse
} from '@/types/cms'

const cmsStatusSchema = z.enum(['draft', 'published', 'archived'])
const cmsTypeSchema = z.enum(['page', 'news', 'tutorial'])
const cmsVisibilitySchema = z.enum(['public', 'authenticated', 'admin_private'])
const cmsPublishAtSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid publish date' })
  .transform((value) => new Date(value).toISOString())

export const cmsContentInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content_type: cmsTypeSchema,
  visibility: cmsVisibilitySchema,
  status: cmsStatusSchema,
  publish_at: z.union([cmsPublishAtSchema, z.null()]).optional(),
  is_homepage: z.boolean().default(false),
  featured_media_id: z.string().uuid().nullable().optional()
})

export const cmsTranslationInputSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES as [SupportedLanguage, ...SupportedLanguage[]]),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).nullable().optional(),
  body_json: z.record(z.string(), z.unknown()).nullable().optional(),
  body_html: z.string().trim().min(1),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(320).nullable().optional(),
  seo_keywords: z.string().trim().max(500).nullable().optional(),
  seo_canonical_url: z.string().trim().url().nullable().optional(),
  og_title: z.string().trim().max(200).nullable().optional(),
  og_description: z.string().trim().max(320).nullable().optional(),
  og_image_media_id: z.string().uuid().nullable().optional(),
  twitter_title: z.string().trim().max(200).nullable().optional(),
  twitter_description: z.string().trim().max(320).nullable().optional(),
  ai_summary: z.string().trim().max(800).nullable().optional(),
  json_ld: z.record(z.string(), z.unknown()).nullable().optional()
})

const listInputSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES as [SupportedLanguage, ...SupportedLanguage[]]),
  type: z.enum(['news', 'tutorial']).nullable().optional(),
  taxonomySlug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
})

async function getPublicCmsVisibilities(): Promise<Array<'public' | 'authenticated'>> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return ['public']
    return data.session?.user ? ['public', 'authenticated'] : ['public']
  } catch {
    return ['public']
  }
}

function buildPublishWindowFilter(nowIso: string): string {
  return `publish_at.is.null,publish_at.lte.${nowIso}`
}

function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid input'
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}

function pickLocalizedTranslation(
  translations: CmsContentI18n[] | null | undefined,
  language: SupportedLanguage
): CmsContentI18n | null {
  if (!translations?.length) return null

  const hasRenderableContent = (translation: CmsContentI18n | null | undefined): boolean => {
    if (!translation) return false
    const title = (translation.title || '').trim()
    const bodyHtml = (translation.body_html || '').trim()
    return title.length > 0 && bodyHtml.length > 0 && bodyHtml !== '<p></p>'
  }

  const currentLanguage = translations.find((t) => t.language === language)
  if (currentLanguage && hasRenderableContent(currentLanguage)) {
    return currentLanguage
  }

  const englishFallback = translations.find((t) => t.language === 'en')
  if (englishFallback) {
    return englishFallback
  }

  const firstRenderable = translations.find((t) => hasRenderableContent(t))
  if (firstRenderable) {
    return firstRenderable
  }

  return currentLanguage ?? translations[0] ?? null
}

function mapContentRowToLocalized(
  row: any,
  language: SupportedLanguage
): CmsLocalizedContent {
  const translations = (row.cms_content_i18n || []) as CmsContentI18n[]
  const rawTaxonomies = (row.cms_content_taxonomies || []) as Array<{ cms_taxonomies: CmsTaxonomy | null }>
  const taxonomies = rawTaxonomies.map((t) => t.cms_taxonomies).filter(Boolean) as CmsTaxonomy[]

  return {
    id: row.id,
    slug: row.slug,
    content_type: row.content_type,
    visibility: row.visibility,
    status: row.status,
    publish_at: row.publish_at,
    is_homepage: row.is_homepage,
    featured_media_id: row.featured_media_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    translation: pickLocalizedTranslation(translations, language),
    translations,
    taxonomies
  }
}

function mapNavigationItem(row: any, language: SupportedLanguage): CmsNavigationItem | null {
  const translations = (row.cms_content_i18n || []) as CmsContentI18n[]
  const translation = pickLocalizedTranslation(translations, language)
  if (!translation?.title?.trim()) {
    return null
  }

  return {
    id: row.id,
    slug: row.slug,
    title: translation.title
  }
}

function hasDocumentationTaxonomy(row: any): boolean {
  const links = (row.cms_content_taxonomies || []) as Array<{ cms_taxonomies: { slug?: string } | { slug?: string }[] | null }>
  for (const link of links) {
    const taxonomyNode = link?.cms_taxonomies
    if (!taxonomyNode) continue

    if (Array.isArray(taxonomyNode)) {
      if (taxonomyNode.some((taxonomy) => taxonomy?.slug === 'documentation')) {
        return true
      }
      continue
    }

    if (taxonomyNode.slug === 'documentation') {
      return true
    }
  }
  return false
}

async function fetchLocalizedContentByQuery(
  query: any,
  language: SupportedLanguage
): Promise<CmsLocalizedContent[]> {
  const { data, error } = await query
  if (error) throw error
  return ((data || []) as any[]).map((row) => mapContentRowToLocalized(row, language))
}

export async function fetchHomepageContent(language: SupportedLanguage): Promise<CmsLocalizedContent | null> {
  const nowIso = new Date().toISOString()
  const visibilities = await getPublicCmsVisibilities()
  const rows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .eq('is_homepage', true)
      .neq('status', 'archived')
      .in('visibility', visibilities)
      .or(buildPublishWindowFilter(nowIso))
      .limit(1),
    language
  )
  return rows[0] || null
}

export async function ensureAdminHomepageContent(language: SupportedLanguage): Promise<CmsLocalizedContent> {
  const existingRows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .eq('is_homepage', true)
      .limit(1),
    language
  )
  const existing = existingRows[0] || null
  if (existing) {
    return existing
  }

  const candidateSlugs = ['home', `home-${Date.now().toString(36)}`]
  let lastError: unknown = null

  for (const slug of candidateSlugs) {
    try {
      const created = await saveCmsContent({
        slug,
        content_type: 'page',
        visibility: 'public',
        status: 'draft',
        publish_at: null,
        is_homepage: true,
        featured_media_id: null
      })

      const loaded = await getAdminContentById(created.id, language)
      if (loaded) {
        return loaded
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) throw lastError
  throw new Error('Unable to create homepage content')
}

export async function fetchCmsNavigation(language: SupportedLanguage): Promise<CmsNavigationResponse> {
  const nowIso = new Date().toISOString()
  const visibilities = await getPublicCmsVisibilities()
  const { data, error } = await supabase
    .from('cms_contents')
    .select(`
      id,
      slug,
      cms_content_i18n (
        language,
        title
      ),
      cms_content_taxonomies (
        cms_taxonomies (
          slug
        )
      )
    `)
    .eq('content_type', 'page')
    .eq('is_homepage', false)
    .neq('status', 'archived')
    .in('visibility', visibilities)
    .or(buildPublishWindowFilter(nowIso))
    .order('publish_at', { ascending: false })

  if (error) throw error

  const staticPages: CmsNavigationItem[] = []
  const docsPages: CmsNavigationItem[] = []

  for (const row of (data || []) as any[]) {
    const item = mapNavigationItem(row, language)
    if (!item) continue

    if (hasDocumentationTaxonomy(row)) {
      docsPages.push(item)
    } else {
      staticPages.push(item)
    }
  }

  return { staticPages, docsPages }
}

export async function fetchCmsPageBySlug(slug: string, language: SupportedLanguage): Promise<CmsLocalizedContent | null> {
  const nowIso = new Date().toISOString()
  const visibilities = await getPublicCmsVisibilities()
  const rows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .eq('slug', slug)
      .neq('status', 'archived')
      .in('visibility', visibilities)
      .or(buildPublishWindowFilter(nowIso))
      .limit(1),
    language
  )
  return rows[0] || null
}

export async function resolveCmsSlugAccess(slug: string): Promise<'public' | 'auth_required' | 'forbidden' | 'not_found'> {
  const { data, error } = await supabase.rpc('cms_resolve_slug_access', {
    p_slug: slug
  })
  if (error) {
    return 'not_found'
  }
  if (data === 'public' || data === 'auth_required' || data === 'forbidden' || data === 'not_found') {
    return data
  }
  return 'not_found'
}

export async function fetchBlogList(params: {
  language: SupportedLanguage
  type?: 'news' | 'tutorial' | null
  taxonomySlug?: string | null
  limit?: number
  offset?: number
}): Promise<CmsListResponse> {
  const nowIso = new Date().toISOString()
  const visibilities = await getPublicCmsVisibilities()
  const parsed = listInputSchema.parse({
    language: params.language,
    type: params.type ?? null,
    taxonomySlug: params.taxonomySlug ?? null,
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
  })

  let filteredContentIds: string[] | null = null
  if (parsed.taxonomySlug) {
    const { data: taxonomyLinks, error: taxonomyError } = await supabase
      .from('cms_content_taxonomies')
      .select(`
        content_id,
        cms_taxonomies!inner (
          slug
        )
      `)
      .eq('cms_taxonomies.slug', parsed.taxonomySlug)

    if (taxonomyError) throw taxonomyError

    filteredContentIds = Array.from(
      new Set((taxonomyLinks || []).map((row: any) => row.content_id).filter(Boolean))
    ) as string[]

    if (filteredContentIds.length === 0) {
      return { items: [], total: 0 }
    }
  }

  let query = supabase
    .from('cms_contents')
    .select(`
      *,
      cms_content_i18n (*),
      cms_content_taxonomies (
        cms_taxonomies (*)
      )
    `, { count: 'exact' })
    .in('content_type', ['news', 'tutorial'])
    .neq('status', 'archived')
    .in('visibility', visibilities)
    .or(buildPublishWindowFilter(nowIso))
    .order('publish_at', { ascending: false })
    .range(parsed.offset, parsed.offset + parsed.limit - 1)

  if (parsed.type) {
    query = query.eq('content_type', parsed.type)
  }
  if (filteredContentIds) {
    query = query.in('id', filteredContentIds)
  }

  const { data, error, count } = await query
  if (error) throw error

  const items = ((data || []) as any[]).map((row) => mapContentRowToLocalized(row, parsed.language))
  return { items, total: count || 0 }
}

export async function fetchBlogPostBySlug(slug: string, language: SupportedLanguage): Promise<CmsLocalizedContent | null> {
  const nowIso = new Date().toISOString()
  const visibilities = await getPublicCmsVisibilities()
  const rows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .eq('slug', slug)
      .in('content_type', ['news', 'tutorial'])
      .neq('status', 'archived')
      .in('visibility', visibilities)
      .or(buildPublishWindowFilter(nowIso))
      .limit(1),
    language
  )
  return rows[0] || null
}

export async function listAdminContents(language: SupportedLanguage): Promise<CmsLocalizedContent[]> {
  const rows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .order('updated_at', { ascending: false }),
    language
  )
  return rows
}

export async function getAdminContentById(id: string, language: SupportedLanguage): Promise<CmsLocalizedContent | null> {
  const rows = await fetchLocalizedContentByQuery(
    supabase
      .from('cms_contents')
      .select(`
        *,
        cms_content_i18n (*),
        cms_content_taxonomies (
          cms_taxonomies (*)
        )
      `)
      .eq('id', id)
      .limit(1),
    language
  )
  return rows[0] || null
}

export async function saveCmsContent(input: z.input<typeof cmsContentInputSchema>): Promise<CmsContent> {
  const parsedResult = cmsContentInputSchema.safeParse(input)
  if (!parsedResult.success) {
    throw new Error(formatValidationError(parsedResult.error))
  }
  const parsed = parsedResult.data
  const payload = {
    slug: parsed.slug,
    content_type: parsed.content_type as CmsContentType,
    visibility: parsed.visibility as CmsVisibility,
    status: parsed.status as CmsStatus,
    publish_at: parsed.publish_at ?? null,
    is_homepage: parsed.is_homepage,
    featured_media_id: parsed.featured_media_id ?? null,
  }

  if (parsed.id) {
    const { data, error } = await supabase
      .from('cms_contents')
      .update(payload)
      .eq('id', parsed.id)
      .select('*')
      .single()
    if (error) throw error
    return data as CmsContent
  }

  const { data, error } = await supabase
    .from('cms_contents')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as CmsContent
}

export async function deleteCmsContent(contentId: string): Promise<void> {
  const id = z.string().uuid().parse(contentId)

  const { data: existing, error: readError } = await supabase
    .from('cms_contents')
    .select('id, is_homepage')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (readError) throw readError
  if (!existing) {
    throw new Error('Content not found')
  }
  if (existing.is_homepage) {
    throw new Error('Homepage cannot be deleted')
  }

  const { error } = await supabase
    .from('cms_contents')
    .delete()
    .eq('id', id)
    .eq('is_homepage', false)

  if (error) throw error
}

export async function saveCmsTranslations(
  contentId: string,
  translations: Array<z.input<typeof cmsTranslationInputSchema>>
): Promise<void> {
  const rows = translations.map((item) => {
    const parsedResult = cmsTranslationInputSchema.safeParse(item)
    if (!parsedResult.success) {
      throw new Error(formatValidationError(parsedResult.error))
    }
    const parsed = parsedResult.data
    return {
      content_id: contentId,
      language: parsed.language,
      title: parsed.title,
      excerpt: parsed.excerpt ?? null,
      body_json: parsed.body_json ?? null,
      body_html: sanitizeCmsHtml(parsed.body_html),
      seo_title: parsed.seo_title ?? null,
      seo_description: parsed.seo_description ?? null,
      seo_keywords: parsed.seo_keywords ?? null,
      seo_canonical_url: parsed.seo_canonical_url ?? null,
      og_title: parsed.og_title ?? null,
      og_description: parsed.og_description ?? null,
      og_image_media_id: parsed.og_image_media_id ?? null,
      twitter_title: parsed.twitter_title ?? null,
      twitter_description: parsed.twitter_description ?? null,
      ai_summary: parsed.ai_summary ?? null,
      json_ld: parsed.json_ld ?? null,
    }
  })

  const { error } = await supabase
    .from('cms_content_i18n')
    .upsert(rows, { onConflict: 'content_id,language' })
  if (error) throw error
}

export async function saveCmsTaxonomyLinks(contentId: string, taxonomyIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('cms_content_taxonomies')
    .delete()
    .eq('content_id', contentId)
  if (deleteError) throw deleteError

  if (taxonomyIds.length === 0) return

  const rows = taxonomyIds.map((taxonomyId) => ({
    content_id: contentId,
    taxonomy_id: taxonomyId,
  }))

  const { error } = await supabase
    .from('cms_content_taxonomies')
    .insert(rows)
  if (error) throw error
}

export async function saveCmsRevision(input: {
  contentId: string
  language: SupportedLanguage
  bodyJson: Record<string, unknown> | null
  bodyHtml: string
  changeNote?: string
}): Promise<void> {
  const { data: latest, error: latestError } = await supabase
    .from('cms_revisions')
    .select('revision_number')
    .eq('content_id', input.contentId)
    .eq('language', input.language)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw latestError

  const nextRevision = (latest?.revision_number || 0) + 1

  const { error } = await supabase
    .from('cms_revisions')
    .insert({
      content_id: input.contentId,
      language: input.language,
      revision_number: nextRevision,
      body_json: input.bodyJson,
      body_html: sanitizeCmsHtml(input.bodyHtml),
      change_note: input.changeNote ?? null,
    })
  if (error) throw error
}

export async function listCmsRevisions(contentId: string): Promise<CmsRevision[]> {
  const { data, error } = await supabase
    .from('cms_revisions')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as CmsRevision[]
}

export async function listCmsTaxonomies(): Promise<CmsTaxonomy[]> {
  const { data, error } = await supabase
    .from('cms_taxonomies')
    .select('*')
    .order('taxonomy_type', { ascending: true })
    .order('slug', { ascending: true })
  if (error) throw error
  return (data || []) as CmsTaxonomy[]
}

export async function upsertCmsTaxonomy(input: {
  id?: string
  slug: string
  taxonomy_type: 'category' | 'tag'
  name_i18n: Record<string, string>
}): Promise<CmsTaxonomy> {
  const payload = {
    id: input.id,
    slug: input.slug,
    taxonomy_type: input.taxonomy_type,
    name_i18n: input.name_i18n,
  }

  const { data, error } = await supabase
    .from('cms_taxonomies')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as CmsTaxonomy
}

export async function triggerCmsRebuild(reason: string): Promise<void> {
  const { error } = await supabase.functions.invoke('cms-trigger-rebuild', {
    body: { reason }
  })
  if (error) throw error
}
