/**
 * Locales Index
 * Central export point for all translation files with lazy loading support
 */

// Only import English statically as fallback (always needed)
import { en } from './en'

// Re-export en type for reference
export type { TranslationKeys } from './en'

// Export English statically (always available as fallback)
export { en }

// Lazy loaders for each language
export const localeLoaders = {
    en: () => Promise.resolve(en),
    it: () => import('./it').then(m => m.it),
    es: () => import('./es').then(m => m.es),
    de: () => import('./de').then(m => m.de),
    fr: () => import('./fr').then(m => m.fr),
    zh: () => import('./zh').then(m => m.zh),
    hi: () => import('./hi').then(m => m.hi),
    ar: () => import('./ar').then(m => m.ar),
    'pt-BR': () => import('./pt-BR').then(m => m.pt),
    ru: () => import('./ru').then(m => m.ru),
    ja: () => import('./ja').then(m => m.ja),
    id: () => import('./id').then(m => m.id),
    bn: () => import('./bn').then(m => m.bn),
} as const

export type SupportedLanguage = keyof typeof localeLoaders
export const SUPPORTED_LANGUAGES = Object.keys(localeLoaders) as SupportedLanguage[]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    en: 'English',
    it: 'Italiano',
    es: 'Español',
    de: 'Deutsch',
    fr: 'Français',
    zh: '简体中文',
    hi: 'हिन्दी',
    ar: 'العربية',
    'pt-BR': 'Português',
    ru: 'Русский',
    ja: '日本語',
    id: 'Bahasa Indonesia',
    bn: 'বাংলা',
}

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
    en: '🇺🇸',
    it: '🇮🇹',
    es: '🇪🇸',
    de: '🇩🇪',
    fr: '🇫🇷',
    zh: '🇨🇳',
    hi: '🇮🇳',
    ar: '🇸🇦',
    'pt-BR': '🇧🇷',
    ru: '🇷🇺',
    ja: '🇯🇵',
    id: '🇮🇩',
    bn: '🇧🇩',
}
