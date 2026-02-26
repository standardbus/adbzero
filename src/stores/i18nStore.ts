/**
 * i18n Store
 * Manages application language and translations with lazy loading
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  en,
  localeLoaders,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  type SupportedLanguage,
  type TranslationKeys,
} from '@/locales'

// Helper type to get nested keys
type NestedKeyOf<T> = T extends object
  ? {
    [K in keyof T]: K extends string
    ? T[K] extends object
    ? `${K}.${NestedKeyOf<T[K]>}` | K
    : K
    : never
  }[keyof T]
  : never

export type TranslationKey = NestedKeyOf<TranslationKeys>

// Cache for loaded translations
const translationsCache: Partial<Record<SupportedLanguage, TranslationKeys>> = {
  en, // English is always available
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: unknown, path: string): any {
  const keys = path.split('.')
  let current = obj as Record<string, any>

  for (const key of keys) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }

  return current
}

/**
 * Detect browser language
 */
function detectBrowserLanguage(): SupportedLanguage {
  const browserLangs = [navigator.language, ...(navigator.languages || [])]

  for (const lang of browserLangs) {
    // Check exact match first (e.g., pt-BR)
    if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
      return lang as SupportedLanguage
    }
    // Then check base language code
    const code = lang.split('-')[0].toLowerCase()
    if (SUPPORTED_LANGUAGES.includes(code as SupportedLanguage)) {
      return code as SupportedLanguage
    }
  }

  return DEFAULT_LANGUAGE
}

/**
 * Load a language's translations
 */
async function loadLanguage(lang: SupportedLanguage): Promise<TranslationKeys> {
  if (translationsCache[lang]) {
    return translationsCache[lang]!
  }

  const loader = localeLoaders[lang]
  if (!loader) {
    console.warn(`No loader found for language: ${lang}`)
    return en
  }

  try {
    const translations = await loader()
    translationsCache[lang] = translations as TranslationKeys
    return translations as TranslationKeys
  } catch (error) {
    console.error(`Failed to load language: ${lang}`, error)
    return en
  }
}

interface I18nState {
  language: SupportedLanguage
  isLoading: boolean
  loadedLanguages: SupportedLanguage[]

  // Actions
  setLanguage: (lang: SupportedLanguage) => Promise<void>
  initLanguage: () => Promise<void>

  /**
   * Translate a key using dot notation (e.g., 'common.cancel', 'nav.dashboard')
   * Supports interpolation with {placeholder} syntax
   */
  t: (key: string, params?: Record<string, any>, options?: { returnObjects?: boolean }) => any

  /**
   * Get localized description from multilingual object or string
   */
  getLocalizedDescription: (
    descriptions: Record<string, string> | string | null | undefined
  ) => string
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: detectBrowserLanguage(),
      isLoading: false,
      loadedLanguages: ['en'],

      initLanguage: async () => {
        const { language, loadedLanguages } = get()
        if (loadedLanguages.includes(language)) return

        set({ isLoading: true })
        await loadLanguage(language)
        set((state) => ({
          isLoading: false,
          loadedLanguages: [...state.loadedLanguages, language],
        }))
      },

      setLanguage: async (lang) => {
        if (!SUPPORTED_LANGUAGES.includes(lang)) return

        const { loadedLanguages } = get()

        if (!loadedLanguages.includes(lang)) {
          set({ isLoading: true })
          await loadLanguage(lang)
          set((state) => ({
            language: lang,
            isLoading: false,
            loadedLanguages: [...state.loadedLanguages, lang],
          }))
        } else {
          set({ language: lang })
        }
      },

      t: (key: string, params?: Record<string, any>, options?: { returnObjects?: boolean }) => {
        const { language } = get()
        const currentTranslations = translationsCache[language] || en
        const fallbackTranslations = en

        // Try current language first
        let translation = getNestedValue(currentTranslations, key)

        // Fallback to English
        if (translation === undefined || translation === null) {
          translation = getNestedValue(fallbackTranslations, key)
        }

        // If still not found, return the key
        if (translation === undefined || translation === null) {
          console.warn(`Missing translation for key: ${key}`)
          return key
        }

        // Handle interpolation only for strings
        if (params && typeof translation === 'string') {
          Object.entries(params).forEach(([paramKey, value]) => {
            translation = (translation as string).replace(
              new RegExp(`\\{${paramKey}\\}`, 'g'),
              String(value)
            )
          })
        }

        // Just use options here so linter is happy (placeholder for future logic)
        if (options?.returnObjects && typeof translation !== 'string') {
          // Logic for returning objects is already implicit by returning 'translation'
        }

        return translation
      },

      getLocalizedDescription: (descriptions) => {
        if (!descriptions) return ''

        // If it's a simple string, return it
        if (typeof descriptions === 'string') return descriptions

        const { language } = get()

        // Try current language
        if (descriptions[language]) return descriptions[language]

        // Fallback to English
        if (descriptions[DEFAULT_LANGUAGE]) return descriptions[DEFAULT_LANGUAGE]

        // Try any available language
        const firstAvailable = Object.values(descriptions).find((d) => d)
        return firstAvailable || ''
      },
    }),
    {
      name: 'adbloater-i18n',
      partialize: (state) => ({
        language: state.language,
      }),
    }
  )
)

// Initialize language on first load
if (typeof window !== 'undefined') {
  useI18nStore.getState().initLanguage()
}

/**
 * Hook for using translations in components
 * Provides reactive access to translation function and language state
 */
export function useTranslation() {
  const language = useI18nStore((state) => state.language)
  const isLoading = useI18nStore((state) => state.isLoading)
  const t = useI18nStore((state) => state.t)
  const getLocalizedDescription = useI18nStore(
    (state) => state.getLocalizedDescription
  )
  const setLanguage = useI18nStore((state) => state.setLanguage)

  return {
    language,
    isLoading,
    t,
    getLocalizedDescription,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE,
    languageNames: LANGUAGE_NAMES,
    languageFlags: LANGUAGE_FLAGS,
  }
}

// Re-export for convenience
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, LANGUAGE_FLAGS }
export type { SupportedLanguage }
