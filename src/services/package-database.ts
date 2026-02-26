/**
 * Package Database Service
 * Gestisce il database dei pacchetti
 * 
 * NUOVA ARCHITETTURA:
 * - Supabase è l'UNICA fonte di verità per i dati
 * - UAD (GitHub) è usato SOLO per il sync iniziale (popolare voci nuove)
 * - Le voci esistenti con nome/descrizione validi NON vengono MAI sovrascritte
 * - Per pacchetti sconosciuti: mostra package_name come nome (senza salvarlo)
 * - NESSUN auto-refresh o merge automatico
 */

import { supabase } from '@/services/supabase'
import { getCurrentLanguage, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'

/**
 * Livello di pericolosità della rimozione
 */
export type RemovalImpact = 'Recommended' | 'Advanced' | 'Expert' | 'Unsafe'

/**
 * Definizione di un pacchetto dal database
 */
export interface PackageDefinition {
  id: string
  list: string
  description: string  // Descrizione nella lingua corrente
  descriptions?: Record<string, string>  // Tutte le descrizioni multilingua
  dependencies: string[]
  neededBy: string[]
  labels: string[]
  removal: RemovalImpact
  // Metadati estesi
  safetyScore?: number
  timesFound?: number
  timesDisabled?: number
  isFromUad?: boolean
  adminVerified?: boolean
  iconBase64?: string
  apkUrl?: string
}

/**
 * Database dei pacchetti
 */
export interface PackageDatabase {
  packages: Record<string, PackageDefinition>
  lastUpdated: Date
  source: 'supabase' | 'cache'
}

// Cache in memoria (nessuna scadenza)
let memoryCache: PackageDatabase | null = null

/**
 * Scarica i pacchetti da Supabase filtrando per nomi specifici.
 * Se packageNames è vuoto o non fornito, non scarica nulla per sicurezza.
 */
async function fetchFromSupabase(lang: SupportedLanguage, packageNames: string[]): Promise<Record<string, PackageDefinition>> {
  if (!packageNames || packageNames.length === 0) return {};

  try {
    console.log(`🔍 Fetching ${packageNames.length} packages from Supabase...`)

    const fetchedPackages: Record<string, PackageDefinition> = {}

    // Batching per evitare limiti della query .in()
    const batchSize = 200
    for (let i = 0; i < packageNames.length; i += batchSize) {
      const batch = packageNames.slice(i, i + batchSize)

      const { data, error } = await supabase
        .from('uad_packages')
        .select('*')
        .in('package_name', batch)

      if (error) {
        console.error('❌ Errore fetch batch Supabase:', error)
        continue
      }

      if (data) {
        for (const row of data) {
          // Estrai la descrizione nella lingua corrente o fallback
          let description = ''
          let descriptionsMap: Record<string, string> = {}

          if (row.description) {
            if (typeof row.description === 'string') {
              try {
                const parsed = JSON.parse(row.description)
                if (typeof parsed === 'object' && parsed !== null) {
                  descriptionsMap = parsed
                  description = parsed[lang] || parsed[DEFAULT_LANGUAGE] || ''
                } else {
                  description = row.description
                  descriptionsMap = { en: row.description }
                }
              } catch {
                description = row.description
                descriptionsMap = { en: row.description }
              }
            } else if (typeof row.description === 'object' && row.description !== null) {
              descriptionsMap = row.description
              description = row.description[lang] || row.description[DEFAULT_LANGUAGE] || ''
            }
          }

          fetchedPackages[row.package_name] = {
            id: row.package_name,
            list: row.list_type || 'Unknown',
            description,
            descriptions: descriptionsMap,
            dependencies: row.dependencies || [],
            neededBy: row.needed_by || [],
            labels: row.labels || [],
            removal: row.removal || 'Expert',
            safetyScore: row.safety_score,
            timesFound: row.times_found,
            timesDisabled: row.times_disabled,
            isFromUad: row.is_from_uad,
            adminVerified: row.admin_verified,
            iconBase64: row.icon_base64,
            apkUrl: row.apk_url
          }
        }
      }
    }

    return fetchedPackages
  } catch (error) {
    console.error('❌ Errore connessione Supabase:', error)
    return {}
  }
}

/**
 * Ottiene il database dei pacchetti filtrato per quelli richiesti.
 */
export async function getPackageDatabase(packageNames?: string[]): Promise<PackageDatabase> {
  const lang = getCurrentLanguage()

  // Se non abbiamo nomi, ritorniamo quello che c'è in cache o vuoto
  if (!packageNames || packageNames.length === 0) {
    return memoryCache || { packages: {}, lastUpdated: new Date(), source: 'cache' }
  }

  // Se abbiamo i nomi, verifichiamo cosa manca nella memory cache
  const missingNames = memoryCache
    ? packageNames.filter(name => !memoryCache!.packages[name])
    : packageNames

  if (missingNames.length > 0) {
    const newPackages = await fetchFromSupabase(lang, missingNames)

    if (memoryCache) {
      memoryCache.packages = { ...memoryCache.packages, ...newPackages }
      memoryCache.lastUpdated = new Date()
    } else {
      memoryCache = {
        packages: newPackages,
        lastUpdated: new Date(),
        source: 'supabase'
      }
    }
  }

  return memoryCache!
}

/**
 * Forza il refresh del database (ignora cache) per i pacchetti specificati.
 * Se non vengono specificati nomi, ricarica tutti quelli attualmente in cache.
 */
export async function refreshPackageDatabase(packageNames?: string[]): Promise<PackageDatabase> {
  const lang = getCurrentLanguage()

  // Se non ci sono nomi forniti, proviamo a ricaricare quelli che avevamo in cache
  const namesToRefresh = packageNames || (memoryCache ? Object.keys(memoryCache.packages) : [])

  if (namesToRefresh.length === 0) {
    memoryCache = null
    return { packages: {}, lastUpdated: new Date(), source: 'supabase' }
  }

  console.log(`🔄 Refreshing ${namesToRefresh.length} packages from Supabase...`)

  const refreshedPackages = await fetchFromSupabase(lang, namesToRefresh)

  memoryCache = {
    packages: refreshedPackages,
    lastUpdated: new Date(),
    source: 'supabase'
  }

  return memoryCache
}

/**
 * Pulisce la cache (per forzare un reload)
 */
export function clearPackageCache(): void {
  memoryCache = null
  console.log('🧹 Cache database pulita')
}

/**
 * Genera un nome leggibile dal package name
 * Usato SOLO per la visualizzazione, NON viene salvato nel database
 */
export function getReadableName(packageName: string): string {
  if (!packageName || packageName.trim().length === 0) return 'Unknown App'

  // Estrai le parti significative dal package name
  const parts = packageName.split('.').filter(p => p.length > 0)

  if (parts.length === 0) return packageName || 'Unknown App'

  // Ignora prefissi comuni (com, org, net, etc.)
  const commonPrefixes = ['com', 'org', 'net', 'io', 'co', 'me', 'tv', 'de', 'fr', 'it', 'jp', 'kr', 'cn']
  const filteredParts = parts.filter(p => !commonPrefixes.includes(p.toLowerCase()) && p.length > 0)

  if (filteredParts.length === 0) {
    // Tutti prefissi comuni, usa l'ultimo disponibile
    const lastPart = parts[parts.length - 1]
    return lastPart && lastPart.length > 0 ? formatWord(lastPart) : packageName
  }

  // Prendi l'ultima parte significativa
  const lastPart = filteredParts[filteredParts.length - 1]

  if (!lastPart || lastPart.length === 0) {
    return packageName || 'Unknown App'
  }

  // Formatta: CamelCase -> Title Case, underscore -> spazi
  const formatted = lastPart
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return formatted && formatted.length > 0 ? formatted : packageName
}

/**
 * Formatta una singola parola in Title Case
 */
function formatWord(word: string): string {
  if (!word || word.length === 0) return ''
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Restituisce i colori associati al livello di impatto
 */
export function getImpactColor(impact: RemovalImpact): { bg: string; text: string } {
  switch (impact) {
    case 'Recommended':
      return { bg: 'bg-green-500/10', text: 'text-green-500' }
    case 'Advanced':
      return { bg: 'bg-yellow-500/10', text: 'text-yellow-500' }
    case 'Expert':
      return { bg: 'bg-orange-500/10', text: 'text-orange-500' }
    case 'Unsafe':
      return { bg: 'bg-red-500/10', text: 'text-red-500' }
    default:
      return { bg: 'bg-surface-500/10', text: 'text-surface-400' }
  }
}

// ============================================
// SYNC UAD -> SUPABASE (Funzione manuale/admin)
// ============================================

// URL del database UAD per sync
const UAD_DATABASE_URL = 'https://raw.githubusercontent.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation/main/resources/assets/uad_lists.json'

/**
 * Sincronizza i dati UAD con Supabase
 * 
 * REGOLE:
 * - Aggiunge SOLO pacchetti che NON esistono in Supabase
 * - NON sovrascrive MAI pacchetti esistenti
 * - Deve essere chiamato MANUALMENTE dall'admin
 * 
 * @returns Numero di pacchetti aggiunti
 */
export async function syncUadToSupabase(): Promise<{ added: number, skipped: number, error?: string }> {
  console.log('📥 Avvio sync UAD -> Supabase...')

  try {
    // 1. Scarica UAD
    const response = await fetch(UAD_DATABASE_URL)
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const uadData = await response.json()
    console.log(`📦 UAD: ${Object.keys(uadData).length} pacchetti trovati`)

    // 2. Ottieni lista pacchetti esistenti in Supabase
    const { data: existingPackages, error: fetchError } = await supabase
      .from('uad_packages')
      .select('package_name')

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`)
    }

    const existingSet = new Set((existingPackages || []).map(p => p.package_name))
    console.log(`📊 Supabase: ${existingSet.size} pacchetti esistenti`)

    // 3. Filtra solo i nuovi pacchetti
    const newPackages: Array<{
      package_name: string
      list_type: string
      removal: string
      description: Record<string, string>
      dependencies: string[]
      needed_by: string[]
      labels: string[]
      is_from_uad: boolean
    }> = []

    for (const [packageName, pkgData] of Object.entries(uadData)) {
      // Salta se già esiste
      if (existingSet.has(packageName)) {
        continue
      }

      const pkg = pkgData as Record<string, unknown>

      newPackages.push({
        package_name: packageName,
        list_type: (pkg.list as string) || 'Misc',
        removal: (pkg.removal as string) || 'Advanced',
        description: { en: (pkg.description as string) || '' },
        dependencies: (pkg.dependencies as string[]) || [],
        needed_by: (pkg.neededBy as string[]) || [],
        labels: [],
        is_from_uad: true
      })
    }

    console.log(`🆕 Nuovi pacchetti da aggiungere: ${newPackages.length}`)

    if (newPackages.length === 0) {
      return { added: 0, skipped: Object.keys(uadData).length - existingSet.size }
    }

    // 4. Inserisci in batch (max 500 per batch)
    const batchSize = 500
    let totalAdded = 0

    for (let i = 0; i < newPackages.length; i += batchSize) {
      const batch = newPackages.slice(i, i + batchSize)

      const { error: insertError } = await supabase
        .from('uad_packages')
        .insert(batch)

      if (insertError) {
        console.error(`❌ Errore inserimento batch ${i / batchSize + 1}:`, insertError)
      } else {
        totalAdded += batch.length
        console.log(`✅ Batch ${i / batchSize + 1} inserito: ${batch.length} pacchetti`)
      }
    }

    // 5. Pulisci cache
    clearPackageCache()

    console.log(`✅ Sync completato: ${totalAdded} aggiunti, ${existingSet.size} già esistenti (non modificati)`)

    return {
      added: totalAdded,
      skipped: existingSet.size
    }

  } catch (error) {
    console.error('❌ Errore sync UAD:', error)
    return {
      added: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
