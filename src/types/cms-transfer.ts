import type { SupportedLanguage } from '@/locales'
import type { CmsContentType, CmsStatus, CmsVisibility } from '@/types/cms'

export const CMS_ARTICLE_TRANSFER_SCHEMA_VERSION = 'adbzero.cms.article.v1' as const

export type CmsArticleTransferMode = 'text' | 'optimized'

export interface CmsArticleTransferSource {
  app: string
  mode: CmsArticleTransferMode
  version?: string
}

export interface CmsArticleTransferMeta {
  schema_version: typeof CMS_ARTICLE_TRANSFER_SCHEMA_VERSION
  exported_at: string
  source: CmsArticleTransferSource
}

export interface CmsArticleTransferContent {
  id: string | null
  slug: string
  content_type: CmsContentType
  visibility: CmsVisibility
  status: CmsStatus
  publish_at: string | null
  is_homepage: boolean
  featured_media_id: string | null
  taxonomy_slugs: string[]
}

export type CmsArticleTransferContentPatch = Partial<CmsArticleTransferContent>

export interface CmsArticleTransferTranslation {
  title: string
  excerpt: string | null
  body_html: string
  body_json: Record<string, unknown> | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  seo_canonical_url: string | null
  og_title: string | null
  og_description: string | null
  og_image_media_id: string | null
  twitter_title: string | null
  twitter_description: string | null
  ai_summary: string | null
  json_ld: Record<string, unknown> | null
}

export type CmsArticleTransferTranslationPatch = Partial<CmsArticleTransferTranslation>

export interface CmsArticleTransferV1 extends CmsArticleTransferMeta {
  content: CmsArticleTransferContentPatch
  translations: Partial<Record<SupportedLanguage, CmsArticleTransferTranslationPatch>>
}

export interface CmsArticleTransferEditorContentState {
  slug: string
  content_type: CmsContentType
  visibility: CmsVisibility
  status: CmsStatus
  publish_at: string | null
  is_homepage: boolean
  featured_media_id: string | null
}

export interface CmsArticleTransferEditorTranslationState {
  title: string
  excerpt: string
  bodyHtml: string
  bodyJson: Record<string, unknown> | null
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  seoCanonicalUrl: string
  ogTitle: string
  ogDescription: string
  ogImageMediaId: string
  twitterTitle: string
  twitterDescription: string
  aiSummary: string
  jsonLdText: string
}

export interface CmsArticleTransferEditorState {
  content: CmsArticleTransferEditorContentState
  translations: Record<SupportedLanguage, CmsArticleTransferEditorTranslationState>
  selectedTaxonomyIds: string[]
  taxonomyBySlug: Record<string, string>
}

export interface CmsArticleTransferMergeResult {
  content: CmsArticleTransferEditorContentState
  translations: Record<SupportedLanguage, CmsArticleTransferEditorTranslationState>
  selectedTaxonomyIds: string[]
  warnings: string[]
}

export interface BuildCmsArticleTransferInput {
  id?: string | null
  content: CmsArticleTransferEditorContentState
  translations: Record<SupportedLanguage, CmsArticleTransferEditorTranslationState>
  taxonomySlugs: string[]
}
