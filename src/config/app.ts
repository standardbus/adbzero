/**
 * App Configuration
 * Configurazione globale dell'applicazione
 */

/**
 * Admin UIDs from environment variable (comma-separated)
 * Set VITE_ADMIN_UIDS in .env file for admin access
 * Format: VITE_ADMIN_UIDS=uid1,uid2,uid3
 *
 * Security: Admin UIDs should be configured server-side in Supabase
 * using app_metadata.role = 'admin'. This env-based fallback is for
 * development/initial setup only.
 */
const ADMIN_UIDS_ENV = import.meta.env.VITE_ADMIN_UIDS || ''
export const ADMIN_UIDS: string[] = ADMIN_UIDS_ENV
  ? ADMIN_UIDS_ENV.split(',').map((uid: string) => uid.trim()).filter(Boolean)
  : []

/**
 * Verifica se un utente è amministratore
 * Checks both environment-based UIDs and Supabase metadata
 */
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false
  return ADMIN_UIDS.includes(userId)
}

/**
 * Versione dell'app
 */
export const APP_VERSION = '1.0.0'

/**
 * Nome dell'app
 */
export const APP_NAME = 'ADBZero'

/**
 * URL repository GitHub
 */
export const GITHUB_URL = 'https://github.com/ADBZero/adbzero'

/**
 * URL canale Telegram
 */
export const TELEGRAM_URL = 'https://t.me/adbzero'

/**
 * URL profilo X (Twitter)
 */
export const TWITTER_URL = 'https://x.com/standardbus'

/**
 * URL profilo Bluesky
 */
export const BLUESKY_URL = 'https://bsky.app/profile/hoxen.bsky.social'

/**
 * URL community Reddit
 */
export const REDDIT_URL = 'https://www.reddit.com/user/StandardBus/'

/**
 * Timeout per i comandi ADB (ms)
 */
export const ADB_COMMAND_TIMEOUT = 30000

/**
 * Numero massimo di log da mantenere
 */
export const MAX_COMMAND_LOGS = 500

/**
 * Chiave localStorage per le impostazioni dell'app
 */
export const APP_SETTINGS_KEY = 'adbloater_settings'

/**
 * Impostazioni predefinite dell'app
 */
export interface AppSettings {
  /** Abilita auto-login basato sul dispositivo */
  deviceAutoLogin: boolean
  /** Abilita estrazione icone e nomi dal dispositivo */
  enableDeviceScraping: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  deviceAutoLogin: true,
  enableDeviceScraping: false
}

/**
 * Recupera le impostazioni dell'app
 */
export function getAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(APP_SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate the parsed data - only accept known keys with correct types
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          deviceAutoLogin: typeof parsed.deviceAutoLogin === 'boolean'
            ? parsed.deviceAutoLogin
            : DEFAULT_APP_SETTINGS.deviceAutoLogin,
          enableDeviceScraping: typeof parsed.enableDeviceScraping === 'boolean'
            ? parsed.enableDeviceScraping
            : DEFAULT_APP_SETTINGS.enableDeviceScraping,
        }
      }
    }
  } catch (e) {
    console.error('Errore lettura impostazioni:', e)
  }
  return DEFAULT_APP_SETTINGS
}

/**
 * Salva le impostazioni dell'app
 */
export function saveAppSettings(settings: Partial<AppSettings>): void {
  try {
    const current = getAppSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Errore salvataggio impostazioni:', e)
  }
}

