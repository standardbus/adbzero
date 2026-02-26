/**
 * De-Google Levels Configuration
 * Definizione dei livelli di de-googling con pacchetti e avvertenze
 */

export type DegoogleLevel = 'essential' | 'low' | 'medium' | 'high' | 'total'

export interface DegoogleLevelConfig {
  id: DegoogleLevel
  name: string
  description: string
  warning: string
  color: string
  bgColor: string
  packages: string[]
  consequences: string[]
}

export const DEGOOGLE_LEVELS: DegoogleLevelConfig[] = [
  {
    id: 'essential',
    name: '',
    description: '',
    warning: '',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    packages: [
      'com.google.android.gms.analytics',
      'com.google.android.gms.measurement',
      'com.google.firebase.analytics',
      'com.google.android.configupdater',
      'com.google.android.feedback',
      'com.google.android.onetimeinitializer',
      'com.google.android.partnersetup',
      'com.google.android.setupwizard',
    ],
    consequences: []
  },
  {
    id: 'low',
    name: '',
    description: '',
    warning: '',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    packages: [
      // Essential packages +
      'com.google.android.gms.analytics',
      'com.google.android.gms.measurement',
      'com.google.firebase.analytics',
      'com.google.android.configupdater',
      'com.google.android.feedback',
      'com.google.android.onetimeinitializer',
      'com.google.android.partnersetup',
      'com.google.android.setupwizard',
      // Low packages
      'com.google.android.apps.books',
      'com.google.android.apps.magazines',
      'com.google.android.apps.tachyon', // Google Duo
      'com.google.android.videos',
      'com.google.android.music',
      'com.google.android.apps.youtube.music',
      'com.google.android.googlequicksearchbox', // Google App
      'com.google.android.apps.podcasts',
      'com.google.android.apps.subscriptions.red',
      'com.google.android.apps.wellbeing',
      'com.google.ar.lens',
      'com.google.android.apps.googleassistant',
      'com.google.android.projection.gearhead', // Android Auto
    ],
    consequences: []
  },
  {
    id: 'medium',
    name: '',
    description: '',
    warning: '',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    packages: [
      // Low packages +
      'com.google.android.gms.analytics',
      'com.google.android.gms.measurement',
      'com.google.firebase.analytics',
      'com.google.android.configupdater',
      'com.google.android.feedback',
      'com.google.android.onetimeinitializer',
      'com.google.android.partnersetup',
      'com.google.android.setupwizard',
      'com.google.android.apps.books',
      'com.google.android.apps.magazines',
      'com.google.android.apps.tachyon',
      'com.google.android.videos',
      'com.google.android.music',
      'com.google.android.apps.youtube.music',
      'com.google.android.googlequicksearchbox',
      'com.google.android.apps.podcasts',
      'com.google.android.apps.subscriptions.red',
      'com.google.android.apps.wellbeing',
      'com.google.ar.lens',
      'com.google.android.apps.googleassistant',
      'com.google.android.projection.gearhead',
      // Medium packages
      'com.google.android.gm', // Gmail
      'com.google.android.apps.maps',
      'com.google.android.apps.photos',
      'com.google.android.apps.docs', // Drive
      'com.google.android.keep', // Keep Notes
      'com.google.android.calendar',
      'com.google.android.contacts',
      'com.google.android.apps.messaging', // Google Messages
      'com.google.android.dialer', // Google Phone
      'com.google.android.apps.nbu.files', // Files by Google
      'com.google.android.apps.chromecast.app', // Google Home
      'com.google.android.apps.walletnfcrel', // Google Wallet
    ],
    consequences: []
  },
  {
    id: 'high',
    name: '',
    description: '',
    warning: '',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    packages: [
      // Medium packages +
      'com.google.android.gms.analytics',
      'com.google.android.gms.measurement',
      'com.google.firebase.analytics',
      'com.google.android.configupdater',
      'com.google.android.feedback',
      'com.google.android.onetimeinitializer',
      'com.google.android.partnersetup',
      'com.google.android.setupwizard',
      'com.google.android.apps.books',
      'com.google.android.apps.magazines',
      'com.google.android.apps.tachyon',
      'com.google.android.videos',
      'com.google.android.music',
      'com.google.android.apps.youtube.music',
      'com.google.android.googlequicksearchbox',
      'com.google.android.apps.podcasts',
      'com.google.android.apps.subscriptions.red',
      'com.google.android.apps.wellbeing',
      'com.google.ar.lens',
      'com.google.android.apps.googleassistant',
      'com.google.android.projection.gearhead',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.apps.photos',
      'com.google.android.apps.docs',
      'com.google.android.keep',
      'com.google.android.calendar',
      'com.google.android.contacts',
      'com.google.android.apps.messaging',
      'com.google.android.dialer',
      'com.google.android.apps.nbu.files',
      'com.google.android.apps.chromecast.app',
      'com.google.android.apps.walletnfcrel',
      // High packages
      'com.google.android.youtube',
      'com.google.android.apps.youtube.kids',
      'com.android.chrome',
      'com.google.android.webview',
      'com.google.android.tts', // Text-to-Speech
      'com.google.android.inputmethod.latin', // Gboard
      'com.google.android.marvin.talkback', // Accessibility
      'com.google.android.syncadapters.calendar',
      'com.google.android.syncadapters.contacts',
      'com.google.android.backuptransport',
    ],
    consequences: []
  },
  {
    id: 'total',
    name: '',
    description: '',
    warning: '',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    packages: [
      // High packages +
      'com.google.android.gms.analytics',
      'com.google.android.gms.measurement',
      'com.google.firebase.analytics',
      'com.google.android.configupdater',
      'com.google.android.feedback',
      'com.google.android.onetimeinitializer',
      'com.google.android.partnersetup',
      'com.google.android.setupwizard',
      'com.google.android.apps.books',
      'com.google.android.apps.magazines',
      'com.google.android.apps.tachyon',
      'com.google.android.videos',
      'com.google.android.music',
      'com.google.android.apps.youtube.music',
      'com.google.android.googlequicksearchbox',
      'com.google.android.apps.podcasts',
      'com.google.android.apps.subscriptions.red',
      'com.google.android.apps.wellbeing',
      'com.google.ar.lens',
      'com.google.android.apps.googleassistant',
      'com.google.android.projection.gearhead',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.apps.photos',
      'com.google.android.apps.docs',
      'com.google.android.keep',
      'com.google.android.calendar',
      'com.google.android.contacts',
      'com.google.android.apps.messaging',
      'com.google.android.dialer',
      'com.google.android.apps.nbu.files',
      'com.google.android.apps.chromecast.app',
      'com.google.android.apps.walletnfcrel',
      'com.google.android.youtube',
      'com.google.android.apps.youtube.kids',
      'com.android.chrome',
      'com.google.android.webview',
      'com.google.android.tts',
      'com.google.android.inputmethod.latin',
      'com.google.android.marvin.talkback',
      'com.google.android.syncadapters.calendar',
      'com.google.android.syncadapters.contacts',
      'com.google.android.backuptransport',
      // Total packages (DANGER!)
      'com.google.android.gms', // Play Services
      'com.android.vending', // Play Store
      'com.google.android.gsf', // Google Services Framework
      'com.google.android.gsf.login',
    ],
    consequences: []
  }
]

/**
 * Ottiene le info di un livello per ID
 */
export function getDegoogleLevel(level: DegoogleLevel): DegoogleLevelConfig | undefined {
  return DEGOOGLE_LEVELS.find(l => l.id === level)
}

/**
 * Conta i pacchetti per ogni livello
 */
export function getPackageCountByLevel(level: DegoogleLevel): number {
  const config = getDegoogleLevel(level)
  return config?.packages.length || 0
}

/**
 * Verifica se un pacchetto è incluso in un livello
 */
export function isPackageInLevel(packageName: string, level: DegoogleLevel): boolean {
  const config = getDegoogleLevel(level)
  return config?.packages.includes(packageName) || false
}

/**
 * Ottiene il livello minimo che include un pacchetto
 */
export function getMinLevelForPackage(packageName: string): DegoogleLevel | null {
  for (const level of DEGOOGLE_LEVELS) {
    if (level.packages.includes(packageName)) {
      return level.id
    }
  }
  return null
}

