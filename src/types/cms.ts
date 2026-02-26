import type { SupportedLanguage } from '@/locales'

export type CmsContentType = 'page' | 'news' | 'tutorial'
export type CmsVisibility = 'public' | 'authenticated' | 'admin_private'
export type CmsStatus = 'draft' | 'published' | 'archived'
export type CmsMediaType = 'image' | 'video' | 'audio' | 'document'

export interface CmsContent {
  id: string
  slug: string
  content_type: CmsContentType
  visibility: CmsVisibility
  status: CmsStatus
  publish_at: string | null
  is_homepage: boolean
  featured_media_id: string | null
  created_at: string
  updated_at: string
}

export interface CmsContentI18n {
  id: string
  content_id: string
  language: SupportedLanguage
  title: string
  excerpt: string | null
  body_json: Record<string, unknown> | null
  body_html: string | null
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
  created_at: string
  updated_at: string
}

export interface CmsTaxonomy {
  id: string
  slug: string
  taxonomy_type: 'category' | 'tag'
  name_i18n: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CmsMediaAsset {
  id: string
  bucket: string
  storage_path: string
  media_type: CmsMediaType
  mime_type: string
  size_bytes: number
  checksum_sha256: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  title_i18n: Record<string, string>
  alt_i18n: Record<string, string>
  caption_i18n: Record<string, string>
  credit_i18n: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CmsRevision {
  id: string
  content_id: string
  language: SupportedLanguage
  revision_number: number
  body_json: Record<string, unknown> | null
  body_html: string | null
  change_note: string | null
  created_at: string
}

export interface CmsLocalizedContent extends CmsContent {
  translation: CmsContentI18n | null
  translations: CmsContentI18n[]
  taxonomies: CmsTaxonomy[]
}

export interface CmsListResponse {
  items: CmsLocalizedContent[]
  total: number
}

export interface ConnectHomeTemplateFeature {
  title: string
  description: string
}

export interface ConnectHomeTemplate {
  hero: {
    title: string
    subtitle: string
    description: string
    badges: string[]
  }
  cta: {
    connectLabel: string
    demoLabel: string
    loginLabel: string
    loginDescription: string
  }
  features: ConnectHomeTemplateFeature[]
  instructions: {
    title: string
    toggleShowLabel: string
    toggleHideLabel: string
    steps: string[]
  }
  disclaimerModal: {
    title: string
    body: string
    acceptLabel: string
    cancelLabel: string
  }
  footerNotices: {
    browserNotice: string
    legalNotice: string
  }
  socialLinks?: {
    github?: string
    twitter?: string
    telegram?: string
    bluesky?: string
    reddit?: string
  }
}

export interface ConnectHomeTemplateBodyJson {
  template_key: 'connect_home'
  connect_template: ConnectHomeTemplate
}

export interface CmsNavigationItem {
  id: string
  slug: string
  title: string
}

export interface CmsNavigationResponse {
  staticPages: CmsNavigationItem[]
  docsPages: CmsNavigationItem[]
}
