/**
 * Play Store Badge Helper
 * Maps locale codes to the correct Google Play Store badge SVG file.
 */

// Mapping of locale codes to badge file names
const BADGE_MAP: Record<string, string> = {
    // Supported locales in the app
    'en': 'GetItOnGooglePlay_Badge_Web_color_English.svg',
    'it': 'GetItOnGooglePlay_Badge_Web_color_Italian.svg',
    'de': 'GetItOnGooglePlay_Badge_Web_color_German.svg',
    'es': 'GetItOnGooglePlay_Badge_Web_color_Spanish.svg',
    'fr': 'GetItOnGooglePlay_Badge_Web_color_French.svg',
    'ja': 'GetItOnGooglePlay_Badge_Web_color_Japanese.svg',
    'zh': 'GetItOnGooglePlay_Badge_Web_color_Chinese-China.svg',
    'ru': 'GetItOnGooglePlay_Badge_Web_color_Russian.svg',
    'ar': 'GetItOnGooglePlay_Badge_Web_color_Arabic-Saudi-Arabia.svg',
    'hi': 'GetItOnGooglePlay_Badge_Web_color_Hindi.svg',
    'bn': 'GetItOnGooglePlay_Badge_Web_Bengali.svg',
    'id': 'GetItOnGooglePlay_Badge_Web_color_Indonesian.svg',
    'pt-BR': 'GetItOnGooglePlay_Badge_Web_color_Portuguese-Brazil.svg',
}

// Default badge (English) if locale not found
const DEFAULT_BADGE = 'GetItOnGooglePlay_Badge_Web_color_English.svg'

/**
 * Gets the Play Store badge filename for a given locale
 * @param locale - The current locale code (e.g., 'en', 'it', 'de')
 * @returns The filename of the appropriate badge SVG
 */
export function getPlayStoreBadgeFilename(locale: string): string {
    return BADGE_MAP[locale] || DEFAULT_BADGE
}

/**
 * Gets the full path to the Play Store badge for a given locale
 * @param locale - The current locale code
 * @returns The full path to the badge SVG
 */
export function getPlayStoreBadgePath(locale: string): string {
    return `/playbadges/${getPlayStoreBadgeFilename(locale)}`
}
