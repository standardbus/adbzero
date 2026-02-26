export interface ConnectCarouselImageMeta {
  id: 'screenmirror' | 'adblock' | 'degoogle' | 'density' | 'desktopmode'
  src: string
  width: number
  height: number
  seoTitle: string
  seoDescription: string
  seoTags: readonly string[]
}

export const CONNECT_CAROUSEL_IMAGES: readonly ConnectCarouselImageMeta[] = [
  {
    id: 'screenmirror',
    src: '/carosello_screenmirror.webp',
    width: 500,
    height: 400,
    seoTitle: 'Android Screen Mirror in real time',
    seoDescription: 'Live Android screen mirroring in the browser with remote control for games and apps.',
    seoTags: ['android screen mirror', 'remote control', 'browser mirroring', 'adb web tool']
  },
  {
    id: 'adblock',
    src: '/carosello_adblock.webp',
    width: 500,
    height: 400,
    seoTitle: 'Privacy Tools with Private DNS ad blocking',
    seoDescription: 'Privacy controls with Private DNS to block ads and trackers system-wide without root access.',
    seoTags: ['private dns', 'ad blocking', 'android privacy', 'tracker blocking']
  },
  {
    id: 'degoogle',
    src: '/carosello_degoogle.webp',
    width: 500,
    height: 400,
    seoTitle: 'De-Google workflow with guided levels',
    seoDescription: 'Guided de-google levels to remove Google services and move toward privacy-friendly alternatives.',
    seoTags: ['degoogle', 'remove google apps', 'android privacy', 'foss alternatives']
  },
  {
    id: 'density',
    src: '/carosello_density.webp',
    width: 500,
    height: 400,
    seoTitle: 'ADB terminal controls for density and resolution',
    seoDescription: 'ADB terminal commands to tune display density and size for better usability on Android devices.',
    seoTags: ['adb terminal', 'wm density', 'wm size', 'android display tuning']
  },
  {
    id: 'desktopmode',
    src: '/carosello_desktopmode.webp',
    width: 500,
    height: 400,
    seoTitle: 'Desktop Mode on virtual display',
    seoDescription: 'Android Desktop Mode in the browser with app launcher and desktop-like interface.',
    seoTags: ['desktop mode', 'virtual display', 'android dex style', 'browser desktop ui']
  }
] as const

export function toAbsolutePublicUrl(assetPath: string): string {
  if (/^https?:\/\//.test(assetPath)) return assetPath
  if (typeof window === 'undefined') return assetPath
  return new URL(assetPath, window.location.origin).toString()
}

export function buildConnectCarouselJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ADB Zero/0 feature screenshots',
    description: 'Homepage screenshot carousel showing core Android management features.',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: CONNECT_CAROUSEL_IMAGES.length,
    itemListElement: CONNECT_CAROUSEL_IMAGES.map((image, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'ImageObject',
        name: image.seoTitle,
        description: image.seoDescription,
        contentUrl: toAbsolutePublicUrl(image.src),
        width: image.width,
        height: image.height,
        keywords: image.seoTags.join(', ')
      }
    }))
  }
}
