
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import slugify from 'slugify'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RichTextEditor } from '@/components/cms/RichTextEditor'
import { useTranslation, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/stores/i18nStore'
import { useAppStore } from '@/stores/appStore'
import { sanitizeCmsHtml } from '@/lib/cms-sanitize'
import {
  buildConnectTemplateBodyJson,
  buildConnectTemplateSnapshotHtml,
  createEmptyConnectHomeTemplate,
  extractConnectTemplateFromBodyJson,
  isConnectHomeTemplateComplete,
} from '@/lib/connect-template'
import {
  cmsContentInputSchema,
  getAdminContentById,
  listCmsTaxonomies,
  deleteCmsContent,
  saveCmsContent,
  saveCmsRevision,
  saveCmsTaxonomyLinks,
  saveCmsTranslations,
  triggerCmsRebuild,
} from '@/services/cms'
import {
  CmsArticleTransferParseError,
  buildCmsArticleTransferFromDraft,
  mergeCmsArticleTransferIntoEditorState,
  parseCmsArticleTransfer,
  serializeCmsArticleTransfer
} from '@/services/cms-transfer'
import type {
  CmsArticleTransferEditorState,
  CmsArticleTransferEditorTranslationState
} from '@/types/cms-transfer'
import type { CmsStatus, CmsTaxonomy, ConnectHomeTemplate } from '@/types/cms'

const editorSchema = cmsContentInputSchema.extend({
  id: z.string().uuid().optional(),
})

const MAX_CMS_IMPORT_FILE_BYTES = 5 * 1024 * 1024

function createDraftSlug(): string {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `content-${ts}-${rnd}`
}

interface TranslationDraft {
  title: string
  excerpt: string
  bodyHtml: string
  bodyJson: Record<string, unknown> | null
  connectTemplate: ConnectHomeTemplate | null
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

function createEmptyDraft(): TranslationDraft {
  return {
    title: '',
    excerpt: '',
    bodyHtml: '<p></p>',
    bodyJson: {},
    connectTemplate: null,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    seoCanonicalUrl: '',
    ogTitle: '',
    ogDescription: '',
    ogImageMediaId: '',
    twitterTitle: '',
    twitterDescription: '',
    aiSummary: '',
    jsonLdText: '',
  }
}

function createInitialTranslations(): Record<SupportedLanguage, TranslationDraft> {
  const initial = {} as Record<SupportedLanguage, TranslationDraft>
  for (const lang of SUPPORTED_LANGUAGES) {
    initial[lang] = createEmptyDraft()
  }
  return initial
}

function cloneTemplate(template: ConnectHomeTemplate): ConnectHomeTemplate {
  return {
    hero: {
      title: template.hero.title,
      subtitle: template.hero.subtitle,
      description: template.hero.description,
      badges: [...template.hero.badges]
    },
    cta: {
      connectLabel: template.cta.connectLabel,
      demoLabel: template.cta.demoLabel,
      loginLabel: template.cta.loginLabel,
      loginDescription: template.cta.loginDescription
    },
    features: template.features.map((item) => ({ ...item })),
    instructions: {
      title: template.instructions.title,
      toggleShowLabel: template.instructions.toggleShowLabel,
      toggleHideLabel: template.instructions.toggleHideLabel,
      steps: [...template.instructions.steps]
    },
    disclaimerModal: {
      title: template.disclaimerModal.title,
      body: template.disclaimerModal.body,
      acceptLabel: template.disclaimerModal.acceptLabel,
      cancelLabel: template.disclaimerModal.cancelLabel
    },
    footerNotices: {
      browserNotice: template.footerNotices.browserNotice,
      legalNotice: template.footerNotices.legalNotice
    },
    socialLinks: template.socialLinks ? { ...template.socialLinks } : undefined
  }
}

export function AdminCmsEditorPage() {
  const { contentId = 'new' } = useParams()
  const isNew = contentId === 'new'
  const { language, t } = useTranslation()
  const navigate = useNavigate()
  const showToast = useAppStore((s) => s.showToast)

  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(
    SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
      ? (language as SupportedLanguage)
      : 'en'
  )
  const [translations, setTranslations] = useState<Record<SupportedLanguage, TranslationDraft>>(createInitialTranslations())
  const [taxonomies, setTaxonomies] = useState<CmsTaxonomy[]>([])
  const [selectedTaxonomies, setSelectedTaxonomies] = useState<string[]>([])
  const [initialStatus, setInitialStatus] = useState<CmsStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors } } = useForm<z.input<typeof editorSchema>>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      slug: createDraftSlug(),
      content_type: 'page',
      visibility: 'public',
      status: 'draft',
      publish_at: null,
      is_homepage: false,
      featured_media_id: null,
    }
  })

  const status = watch('status')
  const contentType = watch('content_type')
  const isHomepage = watch('is_homepage')
  const isConnectHomepage = contentType === 'page' && !!isHomepage

  useEffect(() => {
    if (contentType !== 'page' && isHomepage) {
      setValue('is_homepage', false)
    }
  }, [contentType, isHomepage, setValue])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const [taxonomyRows, existing] = await Promise.all([
        listCmsTaxonomies(),
        isNew ? Promise.resolve(null) : getAdminContentById(contentId, language)
      ])

      if (!mounted) return
      setTaxonomies(taxonomyRows)

      if (existing) {
        setValue('id', existing.id)
        setValue('slug', existing.slug)
        setValue('content_type', existing.content_type)
        setValue('visibility', existing.visibility)
        setValue('status', existing.status)
        setValue('publish_at', existing.publish_at)
        setValue('is_homepage', existing.is_homepage)
        setValue('featured_media_id', existing.featured_media_id)
        setInitialStatus(existing.status)
        setSelectedTaxonomies(existing.taxonomies.map((item) => item.id))

        const nextTranslations = createInitialTranslations()
        for (const tr of existing.translations) {
          nextTranslations[tr.language as SupportedLanguage] = {
            title: tr.title || '',
            excerpt: tr.excerpt || '',
            bodyHtml: tr.body_html || '<p></p>',
            bodyJson: tr.body_json || {},
            connectTemplate: extractConnectTemplateFromBodyJson(tr.body_json),
            seoTitle: tr.seo_title || '',
            seoDescription: tr.seo_description || '',
            seoKeywords: tr.seo_keywords || '',
            seoCanonicalUrl: tr.seo_canonical_url || '',
            ogTitle: tr.og_title || '',
            ogDescription: tr.og_description || '',
            ogImageMediaId: tr.og_image_media_id || '',
            twitterTitle: tr.twitter_title || '',
            twitterDescription: tr.twitter_description || '',
            aiSummary: tr.ai_summary || '',
            jsonLdText: tr.json_ld ? JSON.stringify(tr.json_ld, null, 2) : '',
          }
        }
        setTranslations(nextTranslations)
      }

      setLoading(false)
    }

    load().catch((error) => {
      console.error('CMS editor load error', error)
      showToast({ type: 'error', title: t('cms.saveError'), message: t('cms.loadError') })
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [contentId, isNew, language, setValue, showToast, t])

  useEffect(() => {
    if (!isConnectHomepage) return
    setTranslations((prev) => {
      let changed = false
      const next = { ...prev }
      for (const lang of SUPPORTED_LANGUAGES) {
        if (!next[lang].connectTemplate) {
          next[lang] = { ...next[lang], connectTemplate: createEmptyConnectHomeTemplate() }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [isConnectHomepage])

  const activeDraft = translations[activeLanguage]
  const activeTemplate = useMemo(
    () => activeDraft.connectTemplate || createEmptyConnectHomeTemplate(),
    [activeDraft.connectTemplate]
  )
  const previewBodyHtml = useMemo(() => {
    if (isConnectHomepage) {
      return buildConnectTemplateSnapshotHtml(activeTemplate)
    }
    return activeDraft.bodyHtml || '<p></p>'
  }, [activeDraft.bodyHtml, activeTemplate, isConnectHomepage])
  const safePreviewBodyHtml = useMemo(() => sanitizeCmsHtml(previewBodyHtml), [previewBodyHtml])

  const completion = useMemo(() => {
    let done = 0
    for (const lang of SUPPORTED_LANGUAGES) {
      const draft = translations[lang]
      if (isConnectHomepage) {
        if (isConnectHomeTemplateComplete(draft.connectTemplate)) done += 1
      } else if (draft.title.trim() && draft.bodyHtml.trim() && draft.bodyHtml.trim() !== '<p></p>') {
        done += 1
      }
    }
    return done
  }, [isConnectHomepage, translations])

  const updateActiveDraft = (patch: Partial<TranslationDraft>) => {
    setTranslations((prev) => ({
      ...prev,
      [activeLanguage]: { ...prev[activeLanguage], ...patch }
    }))
  }

  const updateActiveTemplate = (updater: (current: ConnectHomeTemplate) => ConnectHomeTemplate) => {
    setTranslations((prev) => {
      const current = prev[activeLanguage].connectTemplate
        ? cloneTemplate(prev[activeLanguage].connectTemplate as ConnectHomeTemplate)
        : createEmptyConnectHomeTemplate()

      return {
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          connectTemplate: updater(current)
        }
      }
    })
  }

  /** Social links are language-independent: propagate to ALL language drafts */
  const updateSocialLinksForAllLanguages = (patch: Partial<NonNullable<ConnectHomeTemplate['socialLinks']>>) => {
    setTranslations((prev) => {
      const next = { ...prev }
      for (const lang of SUPPORTED_LANGUAGES) {
        const tpl = next[lang].connectTemplate
          ? cloneTemplate(next[lang].connectTemplate as ConnectHomeTemplate)
          : createEmptyConnectHomeTemplate()
        tpl.socialLinks = { ...tpl.socialLinks, ...patch }
        next[lang] = { ...next[lang], connectTemplate: tpl }
      }
      return next
    })
  }

  const taxonomyIdToSlug = useMemo(() => {
    const map: Record<string, string> = {}
    for (const taxonomy of taxonomies) {
      map[taxonomy.id] = taxonomy.slug
    }
    return map
  }, [taxonomies])

  const taxonomySlugToId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const taxonomy of taxonomies) {
      map[taxonomy.slug] = taxonomy.id
    }
    return map
  }, [taxonomies])

  const toTransferTranslationState = (
    draft: TranslationDraft
  ): CmsArticleTransferEditorTranslationState => ({
    title: draft.title,
    excerpt: draft.excerpt,
    bodyHtml: draft.bodyHtml,
    bodyJson: draft.bodyJson,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoKeywords: draft.seoKeywords,
    seoCanonicalUrl: draft.seoCanonicalUrl,
    ogTitle: draft.ogTitle,
    ogDescription: draft.ogDescription,
    ogImageMediaId: draft.ogImageMediaId,
    twitterTitle: draft.twitterTitle,
    twitterDescription: draft.twitterDescription,
    aiSummary: draft.aiSummary,
    jsonLdText: draft.jsonLdText,
  })

  const buildEditorTransferState = (): CmsArticleTransferEditorState => {
    const transferTranslations = {} as Record<SupportedLanguage, CmsArticleTransferEditorTranslationState>
    for (const lang of SUPPORTED_LANGUAGES) {
      transferTranslations[lang] = toTransferTranslationState(translations[lang])
    }

    return {
      content: {
        slug: getValues('slug'),
        content_type: getValues('content_type'),
        visibility: getValues('visibility'),
        status: getValues('status'),
        publish_at: getValues('publish_at') ?? null,
        is_homepage: Boolean(getValues('is_homepage')),
        featured_media_id: getValues('featured_media_id') ?? null,
      },
      translations: transferTranslations,
      selectedTaxonomyIds: [...selectedTaxonomies],
      taxonomyBySlug: taxonomySlugToId,
    }
  }

  const applyMergedTransferState = (nextState: CmsArticleTransferEditorState) => {
    setValue('slug', nextState.content.slug)
    setValue('content_type', nextState.content.content_type)
    setValue('visibility', nextState.content.visibility)
    setValue('status', nextState.content.status)
    setValue('publish_at', nextState.content.publish_at)
    setValue('is_homepage', nextState.content.is_homepage)
    setValue('featured_media_id', nextState.content.featured_media_id)
    setSelectedTaxonomies(nextState.selectedTaxonomyIds)

    setTranslations((prev) => {
      const merged = { ...prev }
      for (const lang of SUPPORTED_LANGUAGES) {
        const incoming = nextState.translations[lang]
        const templateFromJson = extractConnectTemplateFromBodyJson(incoming.bodyJson)
        merged[lang] = {
          ...prev[lang],
          ...incoming,
          connectTemplate: templateFromJson,
        }
      }
      return merged
    })
  }

  const downloadTransferPayload = () => {
    const editorState = buildEditorTransferState()
    const taxonomySlugs = editorState.selectedTaxonomyIds
      .map((taxonomyId) => taxonomyIdToSlug[taxonomyId])
      .filter((slug): slug is string => Boolean(slug))

    const payload = buildCmsArticleTransferFromDraft({
      id: getValues('id') ?? null,
      content: editorState.content,
      translations: editorState.translations,
      taxonomySlugs,
    }, 'text')

    const serialized = serializeCmsArticleTransfer(payload, 'text')
    const safeSlug = slugify(editorState.content.slug || 'cms-article', { lower: true, strict: true, trim: true }) || 'cms-article'
    const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeSlug}.cms.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportTransfer = () => {
    try {
      downloadTransferPayload()
      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('cms.exportText')
      })
    } catch (error: any) {
      console.error('CMS transfer export error', error)
      showToast({
        type: 'error',
        title: t('cms.saveError'),
        message: error?.message || t('common.error')
      })
    }
  }

  const handleImportTransferFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_CMS_IMPORT_FILE_BYTES) {
      showToast({
        type: 'error',
        title: t('cms.importFile'),
        message: t('cms.importInvalid')
      })
      return
    }

    try {
      const text = await file.text()
      const incoming = parseCmsArticleTransfer(text)
      const currentEditorState = buildEditorTransferState()
      const merged = mergeCmsArticleTransferIntoEditorState(currentEditorState, incoming)
      applyMergedTransferState({
        ...currentEditorState,
        ...merged
      })

      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('cms.importApplied')
      })

      if (merged.warnings.length > 0) {
        showToast({
          type: 'warning',
          title: t('common.warning'),
          message: t('cms.importWarnings', { details: merged.warnings.join('; ') })
        })
      }
    } catch (error: any) {
      console.error('CMS transfer import error', error)

      let message = t('cms.importInvalid')
      if (error instanceof CmsArticleTransferParseError && error.code === 'unsupported_version') {
        message = t('cms.importUnsupportedVersion')
      }

      showToast({
        type: 'error',
        title: t('cms.importFile'),
        message
      })
    }
  }

  const onSubmit = handleSubmit(
    async (values: z.input<typeof editorSchema>) => {
      setSaving(true)
      try {
        if (values.status === 'published') {
          const requiredTranslations = isConnectHomepage ? SUPPORTED_LANGUAGES.length : 1
          if (completion < requiredTranslations) {
            showToast({
              type: 'error',
              title: t('cms.publishBlocked'),
              message: isConnectHomepage ? t('cms.translationRequiredConnectTemplate') : t('cms.translationRequired')
            })
            setSaving(false)
            return
          }
        }

        const parsedPublishAt = values.status === 'published'
          ? (values.publish_at || new Date().toISOString())
          : (values.publish_at ?? null)

        const baseContentInput = {
          slug: values.slug,
          content_type: values.content_type,
          visibility: values.visibility,
          is_homepage: values.is_homepage ?? false,
          featured_media_id: values.featured_media_id ?? null,
        } as const

        let ensuredContentId = values.id
        if (!ensuredContentId) {
          const created = await saveCmsContent({
            ...baseContentInput,
            status: 'draft',
            publish_at: null,
          })
          ensuredContentId = created.id
        }

        const translationRows = SUPPORTED_LANGUAGES.map((lang) => {
          const draft = translations[lang]
          let jsonLd: Record<string, unknown> | null = null
          if (draft.jsonLdText.trim()) {
            jsonLd = JSON.parse(draft.jsonLdText)
          }

          let bodyHtml = draft.bodyHtml
          let bodyJson: Record<string, unknown> | null = draft.bodyJson || {}
          let title = draft.title.trim()
          let excerpt = draft.excerpt.trim()

          if (isConnectHomepage) {
            const template = draft.connectTemplate || createEmptyConnectHomeTemplate()
            if (values.status === 'published' && !isConnectHomeTemplateComplete(template)) {
              throw new Error(t('cms.translationRequiredConnectTemplate'))
            }

            bodyJson = buildConnectTemplateBodyJson(template) as unknown as Record<string, unknown>
            bodyHtml = buildConnectTemplateSnapshotHtml(template)
            title = title || template.hero.title.trim()
            excerpt = excerpt || template.hero.subtitle.trim()
          }

          if (!title) {
            title = t('cms.untitledPlaceholder')
          }

          return {
            language: lang,
            title,
            excerpt: excerpt || null,
            body_html: bodyHtml || '<p></p>',
            body_json: bodyJson,
            seo_title: draft.seoTitle || null,
            seo_description: draft.seoDescription || null,
            seo_keywords: draft.seoKeywords || null,
            seo_canonical_url: draft.seoCanonicalUrl || null,
            og_title: draft.ogTitle || null,
            og_description: draft.ogDescription || null,
            og_image_media_id: draft.ogImageMediaId || null,
            twitter_title: draft.twitterTitle || null,
            twitter_description: draft.twitterDescription || null,
            ai_summary: draft.aiSummary || null,
            json_ld: jsonLd,
          }
        })

        await saveCmsTranslations(ensuredContentId, translationRows)
        await saveCmsTaxonomyLinks(ensuredContentId, selectedTaxonomies)
        const content = await saveCmsContent({
          ...baseContentInput,
          id: ensuredContentId,
          status: values.status,
          publish_at: parsedPublishAt
        })

        const activeTranslation = translationRows.find((row) => row.language === activeLanguage)
        await saveCmsRevision({
          contentId: ensuredContentId,
          language: activeLanguage,
          bodyJson: (activeTranslation?.body_json || null) as Record<string, unknown> | null,
          bodyHtml: activeTranslation?.body_html || '<p></p>',
          changeNote: values.status === 'published' ? 'publish' : 'save'
        })

        const shouldTriggerRebuild = (
          values.status !== initialStatus &&
          (values.status === 'published' || initialStatus === 'published')
        )
        if (shouldTriggerRebuild) {
          try {
            await triggerCmsRebuild(values.status === 'published' ? 'cms_publish' : 'cms_unpublish')
          } catch (rebuildError: any) {
            console.error('CMS rebuild trigger error', rebuildError)
            showToast({
              type: 'warning',
              title: t('common.warning'),
              message: rebuildError?.message || t('common.error')
            })
          }
        }
        setInitialStatus(values.status)

        showToast({
          type: 'success',
          title: t('cms.saved'),
          message: t('cms.savedDesc')
        })

        navigate(`/app/admin/cms/editor/${content.id}`)
      } catch (error: any) {
        console.error('CMS save error', error)
        showToast({
          type: 'error',
          title: t('cms.saveError'),
          message: error?.message || t('common.error')
        })
      } finally {
        setSaving(false)
      }
    },
    (formErrors) => {
      const firstError = Object.values(formErrors)[0]
      const message = firstError?.message ? String(firstError.message) : t('common.error')
      showToast({
        type: 'error',
        title: t('cms.saveError'),
        message,
      })
    }
  )

  const handleDeleteCurrentContent = async () => {
    const currentId = getValues('id')
    if (!currentId) return

    if (getValues('is_homepage')) {
      showToast({
        type: 'warning',
        title: t('common.warning'),
        message: t('cms.deleteHomepageBlocked')
      })
      return
    }

    if (!window.confirm(t('cms.deleteConfirm'))) {
      return
    }

    setDeleting(true)
    try {
      await deleteCmsContent(currentId)
      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('cms.deleteSuccess')
      })
      navigate('/app/admin/cms')
    } catch (error: any) {
      console.error('CMS delete error', error)
      showToast({
        type: 'error',
        title: t('cms.deleteError'),
        message: error?.message || t('common.error')
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="text-surface-500">{t('common.loading')}</div>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.slug')}</label>
            <div className="flex gap-2">
              <input
                {...register('slug')}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <button
                type="button"
                onClick={() => {
                  const title = translations[activeLanguage].title || 'page'
                  const nextSlug = slugify(title, { lower: true, strict: true, trim: true }) || 'page'
                  setValue('slug', nextSlug)
                }}
                className="px-3 py-2 rounded-lg bg-surface-100 dark:bg-white/10 text-sm"
              >
                {t('cms.generateSlug')}
              </button>
            </div>
            {errors.slug ? <p className="text-xs text-red-500">{errors.slug.message}</p> : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.type')}</label>
            <select
              {...register('content_type')}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
            >
              <option value="page">{t('cms.page')}</option>
              <option value="news">{t('cms.news')}</option>
              <option value="tutorial">{t('cms.tutorial')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.visibility')}</label>
            <select
              {...register('visibility')}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
            >
              <option value="public">{t('cms.visibility_public')}</option>
              <option value="authenticated">{t('cms.visibility_authenticated')}</option>
              <option value="admin_private">{t('cms.visibility_admin_private')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.status')}</label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
            >
              <option value="draft">{t('cms.status_draft')}</option>
              <option value="published">{t('cms.status_published')}</option>
              <option value="archived">{t('cms.status_archived')}</option>
            </select>
          </div>
        </div>

        {contentType === 'page' ? (
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_homepage')} />
            {t('cms.isHomepage')}
          </label>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.taxonomies')}</label>
          <div className="flex flex-wrap gap-2">
            {taxonomies.map((taxonomy) => {
              const selected = selectedTaxonomies.includes(taxonomy.id)
              return (
                <button
                  type="button"
                  key={taxonomy.id}
                  onClick={() => {
                    setSelectedTaxonomies((prev) => (
                      prev.includes(taxonomy.id)
                        ? prev.filter((id) => id !== taxonomy.id)
                        : [...prev, taxonomy.id]
                    ))
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${selected
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-100 dark:bg-white/10 text-surface-600 dark:text-surface-200'
                    }`}
                >
                  {taxonomy.name_i18n[language] || taxonomy.name_i18n.en || taxonomy.slug}
                </button>
              )
            })}
          </div>
        </div>

        <div className="text-xs text-surface-500">
          {t('cms.translationsCompleted')}: {completion}/{SUPPORTED_LANGUAGES.length}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLanguage(lang)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeLanguage === lang
                ? 'bg-accent-500 text-white'
                : 'bg-surface-100 dark:bg-white/10'
                }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <input
                value={activeDraft.title}
                onChange={(e) => updateActiveDraft({ title: e.target.value })}
                placeholder={t('cms.title')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <input
                value={activeDraft.excerpt}
                onChange={(e) => updateActiveDraft({ excerpt: e.target.value })}
                placeholder={t('cms.excerpt')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
            </div>

            {isConnectHomepage ? (
              <div
                key={`connect-template-${activeLanguage}`}
                className="space-y-4 rounded-xl border border-surface-200 dark:border-white/10 p-4 bg-surface-50/60 dark:bg-surface-950/30"
              >
                <div>
                  <h3 className="font-semibold text-lg">{t('cms.connectTemplateEditor')}</h3>
                  <p className="text-xs text-surface-500 mt-1">{t('cms.connectTemplateHint')}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectHero')}</h4>
                  <input
                    value={activeTemplate.hero.title}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, hero: { ...current.hero, title: e.target.value } }))}
                    placeholder={t('connect.title')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                  />
                  <input
                    value={activeTemplate.hero.subtitle}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, hero: { ...current.hero, subtitle: e.target.value } }))}
                    placeholder={t('connect.subtitle')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                  />
                  <textarea
                    value={activeTemplate.hero.description}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, hero: { ...current.hero, description: e.target.value } }))}
                    placeholder={t('connect.description')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent min-h-20"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {activeTemplate.hero.badges.map((badge, index) => (
                      <input
                        key={`badge-${index}`}
                        value={badge}
                        onChange={(e) => updateActiveTemplate((current) => {
                          const badges = [...current.hero.badges]
                          badges[index] = e.target.value
                          return { ...current, hero: { ...current.hero, badges } }
                        })}
                        placeholder={`${t('cms.connectBadges')} ${index + 1}`}
                        className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectCta')}</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <input
                      value={activeTemplate.cta.connectLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, cta: { ...current.cta, connectLabel: e.target.value } }))}
                      placeholder={t('connect.button')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                    <input
                      value={activeTemplate.cta.demoLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, cta: { ...current.cta, demoLabel: e.target.value } }))}
                      placeholder={t('connect.demoMode')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                    <input
                      value={activeTemplate.cta.loginLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, cta: { ...current.cta, loginLabel: e.target.value } }))}
                      placeholder={t('connect.login')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                    <input
                      value={activeTemplate.cta.loginDescription}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, cta: { ...current.cta, loginDescription: e.target.value } }))}
                      placeholder={t('connect.loginDescription')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectFeatures')}</h4>
                  {activeTemplate.features.map((feature, index) => (
                    <div key={`feature-${index}`} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <input
                        value={feature.title}
                        onChange={(e) => updateActiveTemplate((current) => {
                          const features = [...current.features]
                          features[index] = { ...features[index], title: e.target.value }
                          return { ...current, features }
                        })}
                        placeholder={`${t('cms.title')} ${index + 1}`}
                        className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                      />
                      <input
                        value={feature.description}
                        onChange={(e) => updateActiveTemplate((current) => {
                          const features = [...current.features]
                          features[index] = { ...features[index], description: e.target.value }
                          return { ...current, features }
                        })}
                        placeholder={`${t('cms.seoDescription')} ${index + 1}`}
                        className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectInstructions')}</h4>
                  <input
                    value={activeTemplate.instructions.title}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, instructions: { ...current.instructions, title: e.target.value } }))}
                    placeholder={t('connect.enableUsbDebugging')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <input
                      value={activeTemplate.instructions.toggleShowLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, instructions: { ...current.instructions, toggleShowLabel: e.target.value } }))}
                      placeholder={t('connect.howToEnableUsb')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                    <input
                      value={activeTemplate.instructions.toggleHideLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, instructions: { ...current.instructions, toggleHideLabel: e.target.value } }))}
                      placeholder={t('connect.hideInstructions')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {activeTemplate.instructions.steps.map((step, index) => (
                      <input
                        key={`step-${index}`}
                        value={step}
                        onChange={(e) => updateActiveTemplate((current) => {
                          const steps = [...current.instructions.steps]
                          steps[index] = e.target.value
                          return { ...current, instructions: { ...current.instructions, steps } }
                        })}
                        placeholder={`${t('cms.connectSteps')} ${index + 1}`}
                        className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectDisclaimer')}</h4>
                  <input
                    value={activeTemplate.disclaimerModal.title}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, disclaimerModal: { ...current.disclaimerModal, title: e.target.value } }))}
                    placeholder={t('connect.usageDisclaimerTitle')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                  />
                  <textarea
                    value={activeTemplate.disclaimerModal.body}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, disclaimerModal: { ...current.disclaimerModal, body: e.target.value } }))}
                    placeholder={t('connect.usageDisclaimerBody')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent min-h-24"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <input
                      value={activeTemplate.disclaimerModal.acceptLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, disclaimerModal: { ...current.disclaimerModal, acceptLabel: e.target.value } }))}
                      placeholder={t('connect.usageDisclaimerAccept')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                    <input
                      value={activeTemplate.disclaimerModal.cancelLabel}
                      onChange={(e) => updateActiveTemplate((current) => ({ ...current, disclaimerModal: { ...current.disclaimerModal, cancelLabel: e.target.value } }))}
                      placeholder={t('connect.usageDisclaimerCancel')}
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.connectFooter')}</h4>
                  <textarea
                    value={activeTemplate.footerNotices.browserNotice}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, footerNotices: { ...current.footerNotices, browserNotice: e.target.value } }))}
                    placeholder={t('connect.browserNotice')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent min-h-20"
                  />
                  <textarea
                    value={activeTemplate.footerNotices.legalNotice}
                    onChange={(e) => updateActiveTemplate((current) => ({ ...current, footerNotices: { ...current.footerNotices, legalNotice: e.target.value } }))}
                    placeholder={t('connect.disclaimer')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.socialLinks')}</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <input
                      value={activeTemplate.socialLinks?.github || ''}
                      onChange={(e) => updateSocialLinksForAllLanguages({ github: e.target.value })}
                      placeholder="GitHub URL"
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent font-mono text-xs"
                    />
                    <input
                      value={activeTemplate.socialLinks?.twitter || ''}
                      onChange={(e) => updateSocialLinksForAllLanguages({ twitter: e.target.value })}
                      placeholder="X (Twitter) URL"
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent font-mono text-xs"
                    />
                    <input
                      value={activeTemplate.socialLinks?.telegram || ''}
                      onChange={(e) => updateSocialLinksForAllLanguages({ telegram: e.target.value })}
                      placeholder="Telegram URL"
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent font-mono text-xs"
                    />
                    <input
                      value={activeTemplate.socialLinks?.bluesky || ''}
                      onChange={(e) => updateSocialLinksForAllLanguages({ bluesky: e.target.value })}
                      placeholder="Bluesky URL"
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent font-mono text-xs"
                    />
                    <input
                      value={activeTemplate.socialLinks?.reddit || ''}
                      onChange={(e) => updateSocialLinksForAllLanguages({ reddit: e.target.value })}
                      placeholder="Reddit URL"
                      className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <RichTextEditor
                key={`rich-editor-${activeLanguage}`}
                value={activeDraft.bodyHtml}
                onChange={(html, json) => updateActiveDraft({ bodyHtml: html, bodyJson: json })}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <input
                value={activeDraft.seoTitle}
                onChange={(e) => updateActiveDraft({ seoTitle: e.target.value })}
                placeholder={t('cms.seoTitle')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <input
                value={activeDraft.seoDescription}
                onChange={(e) => updateActiveDraft({ seoDescription: e.target.value })}
                placeholder={t('cms.seoDescription')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <input
                value={activeDraft.seoKeywords}
                onChange={(e) => updateActiveDraft({ seoKeywords: e.target.value })}
                placeholder={t('cms.seoKeywords')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <input
                value={activeDraft.seoCanonicalUrl}
                onChange={(e) => updateActiveDraft({ seoCanonicalUrl: e.target.value })}
                placeholder={t('cms.seoCanonical')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
              />
              <input
                value={activeDraft.aiSummary}
                onChange={(e) => updateActiveDraft({ aiSummary: e.target.value })}
                placeholder={t('cms.aiSummary')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent lg:col-span-2"
              />
              <textarea
                value={activeDraft.jsonLdText}
                onChange={(e) => updateActiveDraft({ jsonLdText: e.target.value })}
                placeholder={t('cms.jsonLd')}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent lg:col-span-2 min-h-24 font-mono text-xs"
              />
            </div>

          </div>

          <aside className="rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50/60 dark:bg-surface-950/30 p-4 space-y-3 xl:sticky xl:top-24 self-start max-h-[calc(100vh-8rem)] overflow-auto">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-surface-500">{t('cms.preview')}</h3>
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-surface-200 dark:bg-white/10">
                {activeLanguage}
              </span>
            </div>

            <article className="space-y-3">
              <h2 className="text-2xl font-black tracking-tight">
                {activeDraft.title.trim() || t('cms.untitledPlaceholder')}
              </h2>
              {activeDraft.excerpt.trim() ? (
                <p className="text-sm text-surface-600 dark:text-surface-300">{activeDraft.excerpt}</p>
              ) : null}
              <div
                className="prose dark:prose-invert max-w-none prose-headings:tracking-tight"
                dangerouslySetInnerHTML={{ __html: safePreviewBodyHtml }}
              />
            </article>
          </aside>
        </div>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,.cms.json,.cms.min.json,text/plain,application/json"
        className="hidden"
        onChange={handleImportTransferFile}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportTransfer}
            className="px-3 py-2 rounded-lg bg-surface-100 dark:bg-white/10 text-sm"
          >
            {t('common.export')}
          </button>
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-surface-100 dark:bg-white/10 text-sm"
          >
            {t('cms.importFile')}
          </button>
          {!isNew && !isHomepage ? (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDeleteCurrentContent}
              className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm disabled:opacity-60"
            >
              {deleting ? t('cms.deleting') : t('common.delete')}
            </button>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-accent-500 text-white disabled:opacity-60"
        >
          {saving ? t('cms.saving') : status === 'published' ? t('cms.saveAndPublish') : t('cms.saveDraft')}
        </button>
      </div>
    </form>
  )
}
