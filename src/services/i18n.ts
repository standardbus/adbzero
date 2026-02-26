/**
 * Internationalization (i18n) Service
 * Re-exports from the new locales system for backwards compatibility
 */

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  type SupportedLanguage,
} from '@/locales'

export { useTranslation, useI18nStore } from '@/stores/i18nStore'

// Legacy functions for backwards compatibility
import { useI18nStore } from '@/stores/i18nStore'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales'

const LANGUAGE_STORAGE_KEY = 'adbloater-i18n'

/**
 * Detect browser language
 */
export function detectBrowserLanguage(): SupportedLanguage {
  const browserLangs = [navigator.language, ...(navigator.languages || [])]

  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase()
    if (SUPPORTED_LANGUAGES.includes(code as SupportedLanguage)) {
      return code as SupportedLanguage
    }
  }

  return DEFAULT_LANGUAGE
}

/**
 * Get current language (from store or detected)
 */
export function getCurrentLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.state?.language && SUPPORTED_LANGUAGES.includes(parsed.state.language)) {
        return parsed.state.language
      }
    }
  } catch {
    // Ignore parse errors
  }
  return detectBrowserLanguage()
}

/**
 * Set language (updates store)
 */
export function setLanguage(lang: SupportedLanguage): void {
  useI18nStore.getState().setLanguage(lang)
}

/**
 * Translate a key (standalone function for non-React contexts)
 */
export function t(key: string, _lang?: SupportedLanguage): string {
  return useI18nStore.getState().t(key)
}

/**
 * Get localized description from multilingual object
 */
export function getLocalizedDescription(
  descriptions: Record<string, string> | string | null | undefined,
  _lang?: SupportedLanguage
): string {
  return useI18nStore.getState().getLocalizedDescription(descriptions)
}
