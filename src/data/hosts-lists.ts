/**
 * Hosts Lists Configuration
 * Liste di blocco per ad-blocking e privacy via file hosts
 */

export type HostsLevel = 'minimal' | 'standard' | 'strict' | 'aggressive'

export interface HostsList {
  id: string
  name: string
  description: string
  url: string
  category: 'ads' | 'tracking' | 'malware' | 'social' | 'adult' | 'gambling' | 'combined'
  estimatedEntries: number
}

export interface HostsLevelConfig {
  id: HostsLevel
  name: string
  description: string
  color: string
  bgColor: string
  lists: string[] // IDs delle liste incluse
  warning?: string
}

// Liste hosts disponibili
export const HOSTS_LISTS: HostsList[] = [
  // Ads
  {
    id: 'stevenblack-base',
    name: 'StevenBlack Hosts',
    description: 'Lista base per blocco ads e malware',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    category: 'combined',
    estimatedEntries: 150000
  },
  {
    id: 'adaway',
    name: 'AdAway',
    description: 'Lista AdAway per Android',
    url: 'https://adaway.org/hosts.txt',
    category: 'ads',
    estimatedEntries: 8000
  },
  {
    id: 'adguard-dns',
    name: 'AdGuard DNS Filter',
    description: 'Lista DNS di AdGuard',
    url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt',
    category: 'ads',
    estimatedEntries: 50000
  },

  // Tracking
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    description: 'Blocco tracker e analytics',
    url: 'https://v.firebog.net/hosts/Easyprivacy.txt',
    category: 'tracking',
    estimatedEntries: 15000
  },
  {
    id: 'disconnect-tracking',
    name: 'Disconnect Tracking',
    description: 'Lista tracker di Disconnect.me',
    url: 'https://s3.amazonaws.com/lists.disconnect.me/simple_tracking.txt',
    category: 'tracking',
    estimatedEntries: 3000
  },

  // Malware
  {
    id: 'malware-domains',
    name: 'Malware Domains',
    description: 'Domini malware conosciuti',
    url: 'https://v.firebog.net/hosts/Prigent-Malware.txt',
    category: 'malware',
    estimatedEntries: 20000
  },
  {
    id: 'phishing',
    name: 'Phishing Army',
    description: 'Protezione anti-phishing',
    url: 'https://phishing.army/download/phishing_army_blocklist_extended.txt',
    category: 'malware',
    estimatedEntries: 10000
  },

  // Social
  {
    id: 'social-block',
    name: 'Social Block',
    description: 'Blocca widget e tracker social',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social/hosts',
    category: 'social',
    estimatedEntries: 3000
  },
  {
    id: 'facebook-tracking',
    name: 'Facebook Tracking',
    description: 'Blocca tracking Facebook/Meta',
    url: 'https://raw.githubusercontent.com/nickspaargaren/no-facebook/master/hosts',
    category: 'social',
    estimatedEntries: 5000
  },

  // Adult
  {
    id: 'adult-block',
    name: 'Adult Content Block',
    description: 'Blocca contenuti per adulti',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts',
    category: 'adult',
    estimatedEntries: 80000
  },

  // Gambling
  {
    id: 'gambling-block',
    name: 'Gambling Block',
    description: 'Blocca siti di gambling',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling/hosts',
    category: 'gambling',
    estimatedEntries: 5000
  }
]

// Configurazione livelli
export const HOSTS_LEVELS: HostsLevelConfig[] = [
  {
    id: 'minimal',
    name: 'Minimale',
    description: 'Solo ads più invasivi. Nessun impatto sulla navigazione.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    lists: ['adaway']
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Ads + tracker comuni. Raccomandata per la maggior parte degli utenti.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    lists: ['stevenblack-base', 'easyprivacy', 'disconnect-tracking']
  },
  {
    id: 'strict',
    name: 'Rigoroso',
    description: 'Aggiunge protezione malware e social tracking.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    lists: ['stevenblack-base', 'easyprivacy', 'disconnect-tracking', 'malware-domains', 'phishing', 'social-block'],
    warning: 'Alcuni siti potrebbero non funzionare correttamente'
  },
  {
    id: 'aggressive',
    name: 'Aggressivo',
    description: 'Blocco massimo. Include social media e tracker di terze parti.',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    lists: ['stevenblack-base', 'adguard-dns', 'easyprivacy', 'disconnect-tracking', 'malware-domains', 'phishing', 'social-block', 'facebook-tracking'],
    warning: 'Molti siti potrebbero avere problemi. Solo per esperti.'
  }
]

/**
 * Ottiene la configurazione di un livello
 */
export function getHostsLevel(level: HostsLevel): HostsLevelConfig | undefined {
  return HOSTS_LEVELS.find(l => l.id === level)
}

/**
 * Ottiene le liste per un livello
 */
export function getListsForLevel(level: HostsLevel): HostsList[] {
  const config = getHostsLevel(level)
  if (!config) return []
  return config.lists.map(id => HOSTS_LISTS.find(l => l.id === id)).filter((l): l is HostsList => l !== undefined)
}

/**
 * Stima il numero totale di entry per un livello
 */
export function getEstimatedEntriesForLevel(level: HostsLevel): number {
  const lists = getListsForLevel(level)
  return lists.reduce((sum, list) => sum + list.estimatedEntries, 0)
}

/**
 * Genera il contenuto del file hosts combinando le liste
 */
export async function generateHostsFile(level: HostsLevel): Promise<string> {
  const lists = getListsForLevel(level)
  const domains = new Set<string>()

  // Header
  let content = `# ADBZero Hosts File
# Level: ${level}
# Generated: ${new Date().toISOString()}
# Total lists: ${lists.length}
#
# This file was automatically generated by ADBZero.com

127.0.0.1 localhost
::1 localhost

`

  // Fetch e merge delle liste
  for (const list of lists) {
    try {
      const response = await fetch(list.url)
      if (!response.ok) continue

      const text = await response.text()
      const lines = text.split('\n')

      for (const line of lines) {
        // Salta commenti e righe vuote
        if (line.startsWith('#') || line.trim() === '') continue

        // Estrai dominio
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
          const domain = parts[1]
          // Ignora localhost e domini locali
          if (domain && domain !== 'localhost' && !domain.startsWith('local')) {
            domains.add(domain)
          }
        } else if (parts.length === 1 && !parts[0].startsWith('0.0.0.0') && !parts[0].startsWith('127.0.0.1')) {
          // Alcune liste hanno solo il dominio
          domains.add(parts[0])
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch ${list.name}:`, error)
    }
  }

  // Genera righe hosts
  const sortedDomains = Array.from(domains).sort()
  for (const domain of sortedDomains) {
    content += `0.0.0.0 ${domain}\n`
  }

  content += `\n# Total blocked: ${sortedDomains.length} domains\n`

  return content
}

/**
 * Private DNS servers per ad-blocking (alternativa non-root)
 */
export const PRIVATE_DNS_SERVERS = [
  {
    id: 'adguard',
    name: 'AdGuard DNS',
    hostname: 'dns.adguard-dns.com',
    description: 'Blocca ads e tracker',
    features: ['Ad blocking', 'Tracker blocking', 'Phishing protection']
  },
  {
    id: 'adguard-family',
    name: 'AdGuard Family',
    hostname: 'family.adguard-dns.com',
    description: 'AdGuard + filtro contenuti adulti',
    features: ['Ad blocking', 'Adult content filter', 'Safe search']
  },
  {
    id: 'nextdns',
    name: 'NextDNS',
    hostname: 'dns.nextdns.io',
    description: 'DNS personalizzabile',
    features: ['Custom blocklists', 'Analytics', 'Parental controls']
  },
  {
    id: 'cloudflare-families',
    name: 'Cloudflare Families',
    hostname: 'family.cloudflare-dns.com',
    description: 'Cloudflare con filtro malware',
    features: ['Malware blocking', 'Adult content filter', 'Fast']
  },
  {
    id: 'quad9',
    name: 'Quad9',
    hostname: 'dns.quad9.net',
    description: 'Focus su sicurezza e privacy',
    features: ['Malware blocking', 'Phishing protection', 'No logging']
  },
  {
    id: 'mullvad',
    name: 'Mullvad DNS',
    hostname: 'adblock.dns.mullvad.net',
    description: 'DNS con ad-blocking di Mullvad VPN',
    features: ['Ad blocking', 'Tracker blocking', 'No logging']
  }
]

