/**
 * FOSS Alternatives Database
 * Mappa pacchetti Google -> alternative open source
 */

export interface FossApp {
  name: string
  packageName: string
  description: string
  fdroidUrl?: string
  githubUrl?: string
  apkUrl?: string
  features: string[]
  category?: 'browser' | 'email' | 'maps' | 'media' | 'productivity' | 'store' | 'social' | 'utility' | 'keyboard' | 'system'
}

export interface GoogleToFossMapping {
  googlePackage: string
  googleName: string
  alternatives: FossApp[]
}

export const FOSS_ALTERNATIVES: GoogleToFossMapping[] = [
  // Browser
  {
    googlePackage: 'com.android.chrome',
    googleName: 'Google Chrome',
    alternatives: [
      {
        name: 'Firefox',
        packageName: 'org.mozilla.firefox',
        description: 'Browser open source con protezione tracking avanzata',
        fdroidUrl: 'https://f-droid.org/packages/org.mozilla.firefox/',
        apkUrl: 'https://download.mozilla.org/?product=fenix-latest&os=android&lang=it',
        features: ['Protezione tracking', 'Estensioni', 'Sync account Firefox']
      },
      {
        name: 'Bromite',
        packageName: 'org.nicetechnologies.nicest',
        description: 'Chromium con ad-blocking e privacy integrati',
        githubUrl: 'https://github.com/nicetechnologies/nicest',
        features: ['Ad-blocking nativo', 'Privacy enhanced', 'Basato su Chromium']
      },
      {
        name: 'Brave',
        packageName: 'com.brave.browser',
        description: 'Browser veloce con blocco ads e tracker',
        apkUrl: 'https://brave.com/download/',
        features: ['Ads bloccati di default', 'Tor integrato', 'Crypto wallet']
      },
      {
        name: 'DuckDuckGo',
        packageName: 'com.duckduckgo.mobile.android',
        description: 'Browser incentrato sulla privacy',
        fdroidUrl: 'https://f-droid.org/packages/com.duckduckgo.mobile.android/',
        features: ['Privacy by design', 'Fire button', 'Email protection']
      }
    ]
  },

  // YouTube
  {
    googlePackage: 'com.google.android.youtube',
    googleName: 'YouTube',
    alternatives: [
      {
        name: 'NewPipe',
        packageName: 'org.schabi.newpipe',
        description: 'Client YouTube leggero senza Google',
        fdroidUrl: 'https://f-droid.org/packages/org.schabi.newpipe/',
        githubUrl: 'https://github.com/TeamNewPipe/NewPipe',
        apkUrl: 'https://github.com/TeamNewPipe/NewPipe/releases/download/v0.27.2/NewPipe_v0.27.2.apk',
        features: ['No ads', 'Download video', 'Background play', 'Popup player']
      },
      {
        name: 'LibreTube',
        packageName: 'com.github.libretube',
        description: 'YouTube via Piped con focus sulla privacy',
        fdroidUrl: 'https://f-droid.org/packages/com.github.libretube/',
        githubUrl: 'https://github.com/libre-tube/LibreTube',
        features: ['Piped backend', 'Subscriptions locali', 'SponsorBlock']
      },
      {
        name: 'ReVanced',
        packageName: 'app.revanced.android.youtube',
        description: 'YouTube patchato con features extra',
        githubUrl: 'https://github.com/ReVanced/revanced-manager',
        features: ['Ad-blocking', 'SponsorBlock', 'Background play', 'Richiede YouTube originale']
      }
    ]
  },

  // Play Store
  {
    googlePackage: 'com.android.vending',
    googleName: 'Google Play Store',
    alternatives: [
      {
        name: 'Aurora Store',
        packageName: 'com.aurora.store',
        description: 'Client alternativo per Play Store senza account Google',
        fdroidUrl: 'https://f-droid.org/packages/com.aurora.store/',
        githubUrl: 'https://gitlab.com/AuroraOSS/AuroraStore',
        apkUrl: 'https://files.auroraoss.com/AuroraStore/Stable/AuroraStore-4.5.1.apk',
        features: ['Download app Play Store', 'Account anonimo', 'Gestione aggiornamenti']
      },
      {
        name: 'F-Droid',
        packageName: 'org.fdroid.fdroid',
        description: 'Store di app open source',
        fdroidUrl: 'https://f-droid.org/',
        features: ['Solo app FOSS', 'Repository custom', 'Build riproducibili']
      },
      {
        name: 'Obtainium',
        packageName: 'dev.imranr.obtainium',
        description: 'Scarica app direttamente da GitHub/GitLab',
        fdroidUrl: 'https://f-droid.org/packages/dev.imranr.obtainium/',
        githubUrl: 'https://github.com/ImranR98/Obtainium',
        features: ['Update da source', 'Supporta GitHub, GitLab, F-Droid', 'Notifiche aggiornamenti']
      }
    ]
  },

  // Maps
  {
    googlePackage: 'com.google.android.apps.maps',
    googleName: 'Google Maps',
    alternatives: [
      {
        name: 'OsmAnd+',
        packageName: 'net.osmand.plus',
        description: 'Mappe offline basate su OpenStreetMap',
        fdroidUrl: 'https://f-droid.org/packages/net.osmand.plus/',
        features: ['Mappe offline', 'Navigazione', 'POI dettagliati', 'Tracciamento GPX']
      },
      {
        name: 'Organic Maps',
        packageName: 'app.organicmaps',
        description: 'Mappe offline veloci e privacy-friendly',
        fdroidUrl: 'https://f-droid.org/packages/app.organicmaps/',
        githubUrl: 'https://github.com/organicmaps/organicmaps',
        features: ['100% offline', 'No tracking', 'Hiking trails', 'Cycling routes']
      },
      {
        name: 'Magic Earth',
        packageName: 'com.generalmagic.magicearth',
        description: 'Navigazione gratuita con mappe offline',
        apkUrl: 'https://www.magicearth.com/',
        features: ['Navigazione turn-by-turn', 'Traffic info', 'Mappe offline', 'Dashcam']
      }
    ]
  },

  // Gmail
  {
    googlePackage: 'com.google.android.gm',
    googleName: 'Gmail',
    alternatives: [
      {
        name: 'K-9 Mail',
        packageName: 'com.fsck.k9',
        description: 'Client email open source potente',
        fdroidUrl: 'https://f-droid.org/packages/com.fsck.k9/',
        features: ['Multi-account', 'PGP encryption', 'IMAP/POP3']
      },
      {
        name: 'FairEmail',
        packageName: 'eu.faircode.email',
        description: 'Email privacy-focused con molte funzionalità',
        fdroidUrl: 'https://f-droid.org/packages/eu.faircode.email/',
        features: ['Privacy by design', 'Biometric lock', 'Unified inbox']
      },
      {
        name: 'Tutanota',
        packageName: 'de.tutao.tutanota',
        description: 'Email encrypted end-to-end',
        fdroidUrl: 'https://f-droid.org/packages/de.tutao.tutanota/',
        features: ['E2E encryption', 'Calendar encrypted', 'No tracking']
      },
      {
        name: 'ProtonMail',
        packageName: 'ch.protonmail.android',
        description: 'Email sicura dalla Svizzera',
        apkUrl: 'https://proton.me/mail/download',
        features: ['E2E encryption', 'Zero-access', 'Swiss privacy laws']
      }
    ]
  },

  // Photos
  {
    googlePackage: 'com.google.android.apps.photos',
    googleName: 'Google Photos',
    alternatives: [
      {
        name: 'Aves',
        packageName: 'deckers.thibault.aves',
        description: 'Galleria moderna con supporto mappe e video',
        fdroidUrl: 'https://f-droid.org/packages/deckers.thibault.aves/',
        features: ['Metadati EXIF', 'Mappe foto', 'Gestione album']
      },
      {
        name: 'Simple Gallery Pro',
        packageName: 'com.simplemobiletools.gallery.pro',
        description: 'Galleria semplice e veloce',
        fdroidUrl: 'https://f-droid.org/packages/com.simplemobiletools.gallery.pro/',
        features: ['Leggera', 'Editor integrato', 'Cartelle nascoste']
      },
      {
        name: 'Ente',
        packageName: 'io.ente.photos',
        description: 'Backup foto encrypted con interfaccia simile a Google Photos',
        fdroidUrl: 'https://f-droid.org/packages/io.ente.photos/',
        features: ['E2E encrypted', 'Cross-platform', 'Sharing sicuro']
      }
    ]
  },

  // Drive
  {
    googlePackage: 'com.google.android.apps.docs',
    googleName: 'Google Drive',
    alternatives: [
      {
        name: 'Nextcloud',
        packageName: 'com.nextcloud.client',
        description: 'Cloud storage self-hosted',
        fdroidUrl: 'https://f-droid.org/packages/com.nextcloud.client/',
        features: ['Self-hosted', 'File sync', 'Collaborazione', 'Calendar/Contacts sync']
      },
      {
        name: 'Syncthing',
        packageName: 'com.nutomic.syncthingandroid',
        description: 'Sync peer-to-peer senza cloud',
        fdroidUrl: 'https://f-droid.org/packages/com.nutomic.syncthingandroid/',
        features: ['P2P sync', 'No cloud', 'Open protocol']
      },
      {
        name: 'Cryptomator',
        packageName: 'org.cryptomator',
        description: 'Encryption per qualsiasi cloud',
        fdroidUrl: 'https://f-droid.org/packages/org.cryptomator/',
        features: ['Cripta file cloud', 'Compatibile con tutti i cloud', 'Zero-knowledge']
      }
    ]
  },

  // Keyboard
  {
    googlePackage: 'com.google.android.inputmethod.latin',
    googleName: 'Gboard',
    alternatives: [
      {
        name: 'OpenBoard',
        packageName: 'org.dslul.openboard.inputmethod.latin',
        description: 'Tastiera AOSP migliorata, privacy-friendly',
        fdroidUrl: 'https://f-droid.org/packages/org.dslul.openboard.inputmethod.latin/',
        features: ['Basata su AOSP', 'No internet', 'Swipe typing']
      },
      {
        name: 'FlorisBoard',
        packageName: 'dev.patrickgold.florisboard',
        description: 'Tastiera moderna open source',
        fdroidUrl: 'https://f-droid.org/packages/dev.patrickgold.florisboard/',
        githubUrl: 'https://github.com/florisboard/florisboard',
        features: ['In sviluppo attivo', 'Temi custom', 'Glide typing']
      },
      {
        name: 'AnySoftKeyboard',
        packageName: 'com.menny.android.anysoftkeyboard',
        description: 'Tastiera con molte lingue e temi',
        fdroidUrl: 'https://f-droid.org/packages/com.menny.android.anysoftkeyboard/',
        features: ['Molte lingue', 'Temi', 'Gesture']
      }
    ]
  },

  // Google Keep
  {
    googlePackage: 'com.google.android.keep',
    googleName: 'Google Keep',
    alternatives: [
      {
        name: 'Joplin',
        packageName: 'net.cozic.joplin',
        description: 'Note-taking con sync e markdown',
        fdroidUrl: 'https://f-droid.org/packages/net.cozic.joplin/',
        features: ['Markdown', 'E2E encryption', 'Sync Nextcloud/Dropbox']
      },
      {
        name: 'Standard Notes',
        packageName: 'com.standardnotes',
        description: 'Note encrypted di default',
        apkUrl: 'https://standardnotes.com/download',
        features: ['E2E encrypted', 'Cross-platform', 'Extensions']
      },
      {
        name: 'Notesnook',
        packageName: 'com.streetwriters.notesnook',
        description: 'Note private con focus sulla sicurezza',
        fdroidUrl: 'https://f-droid.org/packages/com.streetwriters.notesnook/',
        features: ['Zero-knowledge', 'Rich text', 'Note locking']
      }
    ]
  },

  // Messages
  {
    googlePackage: 'com.google.android.apps.messaging',
    googleName: 'Google Messages',
    alternatives: [
      {
        name: 'Signal',
        packageName: 'org.thoughtcrime.securesms',
        description: 'Messaggistica encrypted #1',
        apkUrl: 'https://signal.org/android/apk/',
        features: ['E2E encryption', 'Voice/Video calls', 'Groups', 'Disappearing messages']
      },
      {
        name: 'QKSMS',
        packageName: 'com.moez.QKSMS',
        description: 'SMS/MMS app open source',
        fdroidUrl: 'https://f-droid.org/packages/com.moez.QKSMS/',
        features: ['Material design', 'Scheduled messages', 'Backup']
      },
      {
        name: 'Silence',
        packageName: 'org.smssecure.smssecure',
        description: 'SMS encrypted',
        fdroidUrl: 'https://f-droid.org/packages/org.smssecure.smssecure/',
        features: ['SMS encryption', 'Password lock', 'No internet needed']
      }
    ]
  },

  // Calendar
  {
    googlePackage: 'com.google.android.calendar',
    googleName: 'Google Calendar',
    alternatives: [
      {
        name: 'Etar',
        packageName: 'ws.xsoh.etar',
        description: 'Calendario open source material design',
        fdroidUrl: 'https://f-droid.org/packages/ws.xsoh.etar/',
        features: ['CalDAV sync', 'Widgets', 'Dark mode']
      },
      {
        name: 'Simple Calendar Pro',
        packageName: 'com.simplemobiletools.calendar.pro',
        description: 'Calendario semplice e leggero',
        fdroidUrl: 'https://f-droid.org/packages/com.simplemobiletools.calendar.pro/',
        features: ['Offline', 'Widgets', 'CalDAV support']
      }
    ]
  }
]

/**
 * Trova alternative FOSS per un pacchetto Google
 */
export function getAlternativesForPackage(googlePackage: string): FossApp[] {
  const mapping = FOSS_ALTERNATIVES.find(m => m.googlePackage === googlePackage)
  return mapping?.alternatives || []
}

/**
 * Ottiene tutte le alternative raggruppate per categoria
 */
export function getAlternativesByCategory(): Record<string, FossApp[]> {
  const byCategory: Record<string, FossApp[]> = {}

  FOSS_ALTERNATIVES.forEach(mapping => {
    mapping.alternatives.forEach(alt => {
      if (!byCategory[alt.category || 'utility']) {
        byCategory[alt.category || 'utility'] = []
      }
      // Evita duplicati
      if (!byCategory[alt.category || 'utility'].find(a => a.packageName === alt.packageName)) {
        byCategory[alt.category || 'utility'].push(alt)
      }
    })
  })

  return byCategory
}

/**
 * Cerca alternative per nome
 */
export function searchAlternatives(query: string): FossApp[] {
  const lowerQuery = query.toLowerCase()
  const results: FossApp[] = []

  FOSS_ALTERNATIVES.forEach(mapping => {
    mapping.alternatives.forEach(alt => {
      if (
        alt.name.toLowerCase().includes(lowerQuery) ||
        alt.description.toLowerCase().includes(lowerQuery) ||
        alt.packageName.toLowerCase().includes(lowerQuery)
      ) {
        if (!results.find(r => r.packageName === alt.packageName)) {
          results.push(alt)
        }
      }
    })
  })

  return results
}

