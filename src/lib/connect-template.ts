import { z } from 'zod'
import type { ConnectHomeTemplate, ConnectHomeTemplateBodyJson } from '@/types/cms'
import { GITHUB_URL, TWITTER_URL, TELEGRAM_URL, BLUESKY_URL, REDDIT_URL } from '@/config/app'

const connectFeatureSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1)
})

export const connectHomeTemplateSchema = z.object({
  hero: z.object({
    title: z.string().trim().min(1),
    subtitle: z.string().trim().min(1),
    description: z.string().trim().min(1),
    badges: z.array(z.string().trim().min(1)).min(1)
  }),
  cta: z.object({
    connectLabel: z.string().trim().min(1),
    demoLabel: z.string().trim().min(1),
    loginLabel: z.string().trim().min(1),
    loginDescription: z.string().trim().min(1)
  }),
  features: z.array(connectFeatureSchema).length(3),
  instructions: z.object({
    title: z.string().trim().min(1),
    toggleShowLabel: z.string().trim().min(1),
    toggleHideLabel: z.string().trim().min(1),
    steps: z.array(z.string().trim().min(1)).length(5)
  }),
  disclaimerModal: z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    acceptLabel: z.string().trim().min(1),
    cancelLabel: z.string().trim().min(1)
  }),
  footerNotices: z.object({
    browserNotice: z.string().trim().min(1),
    legalNotice: z.string().trim().min(1)
  }),
  socialLinks: z.object({
    github: z.string().trim().url().optional().or(z.literal('')),
    twitter: z.string().trim().url().optional().or(z.literal('')),
    telegram: z.string().trim().url().optional().or(z.literal('')),
    bluesky: z.string().trim().url().optional().or(z.literal('')),
    reddit: z.string().trim().url().optional().or(z.literal(''))
  }).optional()
})

export const connectHomeBodyJsonSchema = z.object({
  template_key: z.literal('connect_home'),
  connect_template: connectHomeTemplateSchema
})

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createEmptyConnectHomeTemplate(): ConnectHomeTemplate {
  return {
    hero: {
      title: '',
      subtitle: '',
      description: '',
      badges: ['', '', '']
    },
    cta: {
      connectLabel: '',
      demoLabel: '',
      loginLabel: '',
      loginDescription: ''
    },
    features: [
      { title: '', description: '' },
      { title: '', description: '' },
      { title: '', description: '' }
    ],
    instructions: {
      title: '',
      toggleShowLabel: '',
      toggleHideLabel: '',
      steps: ['', '', '', '', '']
    },
    disclaimerModal: {
      title: '',
      body: '',
      acceptLabel: '',
      cancelLabel: ''
    },
    footerNotices: {
      browserNotice: '',
      legalNotice: ''
    },
    socialLinks: {
      github: '',
      twitter: '',
      telegram: '',
      bluesky: '',
      reddit: ''
    }
  }
}

export function createDefaultConnectHomeTemplate(
  t: (key: string, params?: Record<string, unknown>) => string
): ConnectHomeTemplate {
  const badges = (t('connect.features') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    hero: {
      title: t('connect.title'),
      subtitle: t('connect.subtitle'),
      description: t('connect.description'),
      badges: badges.length ? badges : [t('connect.features')]
    },
    cta: {
      connectLabel: t('connect.button'),
      demoLabel: t('connect.demoMode'),
      loginLabel: t('connect.login'),
      loginDescription: t('connect.loginDescription')
    },
    features: [
      {
        title: t('connect.featurePrivacy.title'),
        description: t('connect.featurePrivacy.description')
      },
      {
        title: t('connect.featureFast.title'),
        description: t('connect.featureFast.description')
      },
      {
        title: t('connect.featureComplete.title'),
        description: t('connect.featureComplete.description')
      }
    ],
    instructions: {
      title: t('connect.enableUsbDebugging'),
      toggleShowLabel: t('connect.howToEnableUsb'),
      toggleHideLabel: t('connect.hideInstructions'),
      steps: [
        t('connect.step1'),
        t('connect.step2'),
        t('connect.step3'),
        t('connect.step4'),
        t('connect.step5')
      ]
    },
    disclaimerModal: {
      title: t('connect.usageDisclaimerTitle'),
      body: t('connect.usageDisclaimerBody'),
      acceptLabel: t('connect.usageDisclaimerAccept'),
      cancelLabel: t('connect.usageDisclaimerCancel')
    },
    footerNotices: {
      browserNotice: t('connect.browserNotice'),
      legalNotice: t('connect.disclaimer')
    },
    socialLinks: {
      github: GITHUB_URL,
      twitter: TWITTER_URL,
      telegram: TELEGRAM_URL,
      bluesky: BLUESKY_URL,
      reddit: REDDIT_URL
    }
  }
}

export function isConnectHomeTemplateComplete(template: ConnectHomeTemplate | null | undefined): boolean {
  return !!template && connectHomeTemplateSchema.safeParse(template).success
}

export function buildConnectTemplateBodyJson(template: ConnectHomeTemplate): ConnectHomeTemplateBodyJson {
  return {
    template_key: 'connect_home',
    connect_template: template
  }
}

export function extractConnectTemplateFromBodyJson(
  bodyJson: Record<string, unknown> | null | undefined
): ConnectHomeTemplate | null {
  const parsed = connectHomeBodyJsonSchema.safeParse(bodyJson)
  if (!parsed.success) return null
  return parsed.data.connect_template
}

export function decodeConnectTemplateWithFallback(
  bodyJson: Record<string, unknown> | null | undefined,
  fallback: ConnectHomeTemplate
): ConnectHomeTemplate {
  const parsed = extractConnectTemplateFromBodyJson(bodyJson)
  return parsed || fallback
}

export function buildConnectTemplateSnapshotHtml(template: ConnectHomeTemplate): string {
  const heroBadges = template.hero.badges
    .map((badge) => `<li>${escapeHtml(badge)}</li>`)
    .join('')

  const features = template.features
    .map((feature) => (
      `<li><strong>${escapeHtml(feature.title)}</strong><p>${escapeHtml(feature.description)}</p></li>`
    ))
    .join('')

  const steps = template.instructions.steps
    .map((step, index) => `<li>${index + 1}. ${escapeHtml(step)}</li>`)
    .join('')

  return [
    '<section data-template="connect_home">',
    `<h1>${escapeHtml(template.hero.title)}</h1>`,
    `<h2>${escapeHtml(template.hero.subtitle)}</h2>`,
    `<p>${escapeHtml(template.hero.description)}</p>`,
    `<ul>${heroBadges}</ul>`,
    `<h3>${escapeHtml(template.instructions.title)}</h3>`,
    `<ol>${steps}</ol>`,
    `<ul>${features}</ul>`,
    `<h4>${escapeHtml(template.disclaimerModal.title)}</h4>`,
    `<p>${escapeHtml(template.disclaimerModal.body)}</p>`,
    `<p>${escapeHtml(template.footerNotices.browserNotice)}</p>`,
    `<p>${escapeHtml(template.footerNotices.legalNotice)}</p>`,
    '</section>'
  ].join('')
}
