/**
 * App Icons & Labels Service
 * Gestisce icone e nomi reali delle app Android
 * - Cache persistente in IndexedDB
 * - Upload a Supabase per condivisione community
 * - Estrazione dal dispositivo senza dipendere da aapt
 */

import * as adbClient from './adb-client'
import { supabase } from './supabase'
import { getAppSettings } from '@/config/app'

// ============================================
// INDEXEDDB CACHE
// ============================================

const DB_NAME = 'adbloater_app_cache'
const DB_VERSION = 1
const ICONS_STORE = 'icons'
const LABELS_STORE = 'labels'

let dbInstance: IDBDatabase | null = null

async function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ICONS_STORE)) {
        db.createObjectStore(ICONS_STORE, { keyPath: 'packageName' })
      }
      if (!db.objectStoreNames.contains(LABELS_STORE)) {
        db.createObjectStore(LABELS_STORE, { keyPath: 'packageName' })
      }
    }
  })
}

// ============================================
// MEMORY CACHE
// ============================================

// Cache in memoria per accesso veloce
const iconMemoryCache = new Map<string, string>()
const labelMemoryCache = new Map<string, string>()

// Pacchetti già tentati senza successo
const iconNotFound = new Set<string>()
const labelNotFound = new Set<string>()

// ============================================
// ICONS
// ============================================

/**
 * Carica un'icona dalla cache IndexedDB
 */
async function loadIconFromDb(packageName: string): Promise<string | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(ICONS_STORE, 'readonly')
      const request = tx.objectStore(ICONS_STORE).get(packageName)
      request.onsuccess = () => resolve(request.result?.iconData || null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Salva un'icona nella cache IndexedDB
 */
async function saveIconToDb(packageName: string, iconData: string): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(ICONS_STORE, 'readwrite')
    tx.objectStore(ICONS_STORE).put({
      packageName,
      iconData,
      timestamp: Date.now()
    })
  } catch (e) {
    console.warn('Errore salvataggio icona in IndexedDB:', e)
  }
}

/**
 * Estrae l'icona di un'app dal dispositivo Android
 * Usa metodi che funzionano senza aapt
 */
export async function getAppIcon(packageName: string): Promise<string | null> {
  // 1. Check memory cache
  if (iconMemoryCache.has(packageName)) {
    return iconMemoryCache.get(packageName)!
  }

  // Skip if already tried and failed
  if (iconNotFound.has(packageName)) {
    return null
  }

  // 2. Check IndexedDB cache
  const cached = await loadIconFromDb(packageName)
  if (cached) {
    iconMemoryCache.set(packageName, cached)
    return cached
  }

  // 3. Prova a estrarre dal dispositivo
  try {
    const iconData = await extractIconFromDevice(packageName)
    if (iconData) {
      iconMemoryCache.set(packageName, iconData)
      saveIconToDb(packageName, iconData) // Async, non blocca
      // Upload a Supabase in background
      uploadIconToSupabase(packageName, iconData)
      return iconData
    }
  } catch (e) {
    console.warn(`Errore estrazione icona ${packageName}:`, e)
  }

  iconNotFound.add(packageName)
  return null
}

/**
 * Estrae l'icona dal dispositivo usando metodi alternativi a aapt
 */
async function extractIconFromDevice(packageName: string): Promise<string | null> {
  // Check global setting
  if (!getAppSettings().enableDeviceScraping) {
    return null
  }

  // Ottieni il path dell'APK
  const pathResult = await adbClient.shell(`pm path ${packageName} 2>/dev/null | head -1`)
  if (!pathResult.stdout.trim()) return null

  const apkPath = pathResult.stdout.replace('package:', '').trim()
  if (!apkPath) return null

  try {
    // Prima elenca i file nell'APK per trovare l'icona - molto più veloce
    const listResult = await adbClient.shell(
      `unzip -l "${apkPath}" 2>/dev/null | grep -E "(ic_launcher|app_icon)" | grep -E "\\.(png|webp)$" | head -20`
    )

    if (listResult.stdout.trim()) {
      // Pattern per trovare l'icona migliore (preferisco xxxhdpi > xxhdpi > xhdpi > hdpi)
      const lines = listResult.stdout.split('\n')
      let bestIcon: string | null = null
      let bestPriority = -1

      // Priorità delle densità (più alto = migliore)
      const densityPriority: Record<string, number> = {
        'xxxhdpi': 6,
        'xxhdpi': 5,
        'xhdpi': 4,
        'hdpi': 3,
        'mdpi': 2,
        'ldpi': 1
      }

      // Preferenze di nome (ic_launcher_round < ic_launcher_foreground < ic_launcher)
      const namePriority: Record<string, number> = {
        'ic_launcher.png': 10,
        'ic_launcher.webp': 10,
        'app_icon.png': 9,
        'app_icon.webp': 9,
        'ic_launcher_round.png': 8,
        'ic_launcher_round.webp': 8,
        'ic_launcher_foreground.png': 7,
        'ic_launcher_foreground.webp': 7
      }

      for (const line of lines) {
        // Estrai il path del file dalla riga di output di unzip -l
        // Formato: "  12345  01-01-2020 00:00   res/path/to/file.png"
        const match = line.match(/\s+\d+\s+[\d-]+\s+[\d:]+\s+(.+)/);
        if (!match) continue

        const filePath = match[1].trim()
        if (!filePath) continue

        // Calcola la priorità
        let priority = 0

        // Priorità della densità
        for (const [density, dPriority] of Object.entries(densityPriority)) {
          if (filePath.includes(density)) {
            priority += dPriority * 10 // La densità è più importante
            break
          }
        }

        // Priorità del nome
        const fileName = filePath.split('/').pop() || ''
        for (const [name, nPriority] of Object.entries(namePriority)) {
          if (fileName === name || fileName.endsWith(name)) {
            priority += nPriority
            break
          }
        }

        // Preferisci mipmap a drawable
        if (filePath.includes('mipmap')) {
          priority += 5
        }

        if (priority > bestPriority) {
          bestPriority = priority
          bestIcon = filePath
        }
      }

      // Estrai l'icona migliore trovata
      if (bestIcon) {
        const extractResult = await adbClient.shell(
          `unzip -p "${apkPath}" "${bestIcon}" 2>/dev/null | base64 2>/dev/null`
        )

        if (extractResult.stdout.trim() && extractResult.stdout.length > 200) {
          const base64Clean = extractResult.stdout.replace(/\s/g, '')
          if (base64Clean.length > 100) {
            const ext = bestIcon.endsWith('.webp') ? 'webp' : 'png'
            return `data:image/${ext};base64,${base64Clean}`
          }
        }
      }
    }

    // Fallback: prova i pattern più comuni direttamente
    const fallbackPatterns = [
      'res/mipmap-xxxhdpi-v4/ic_launcher.png',
      'res/mipmap-xxhdpi-v4/ic_launcher.png',
      'res/mipmap-xxxhdpi/ic_launcher.png',
      'res/drawable-xxxhdpi-v4/ic_launcher.png'
    ]

    for (const pattern of fallbackPatterns) {
      const result = await adbClient.shell(
        `unzip -p "${apkPath}" "${pattern}" 2>/dev/null | base64 2>/dev/null`
      )

      if (result.stdout.trim() && result.stdout.length > 200) {
        const base64Clean = result.stdout.replace(/\s/g, '')
        if (base64Clean.length > 100) {
          return `data:image/png;base64,${base64Clean}`
        }
      }
    }

  } catch (e) {
    console.warn(`Errore estrazione icona ${packageName}:`, e)
  }

  return null
}

/**
 * Upload icona a Supabase per condivisione community
 */
async function uploadIconToSupabase(packageName: string, iconData: string): Promise<void> {
  try {
    await supabase
      .from('uad_packages')
      .update({ icon_base64: iconData })
      .eq('package_name', packageName)
  } catch {
    // Ignora errori di upload
  }
}

/**
 * Ottiene l'icona dalla cache memory (sincrono)
 */
export function getCachedIcon(packageName: string): string | null {
  return iconMemoryCache.get(packageName) ?? null
}

/**
 * Precarica le icone per una lista di pacchetti
 * Carica solo quelle non in cache
 */
export async function preloadIcons(packageNames: string[], maxConcurrent = 3): Promise<void> {
  // Filtra pacchetti già in cache o già falliti
  const toLoad = packageNames.filter(
    pkg => !iconMemoryCache.has(pkg) && !iconNotFound.has(pkg)
  )

  // Limita per performance
  const limitedLoad = toLoad.slice(0, 30)

  // Carica in batch paralleli
  for (let i = 0; i < limitedLoad.length; i += maxConcurrent) {
    const batch = limitedLoad.slice(i, i + maxConcurrent)
    await Promise.all(batch.map(pkg => getAppIcon(pkg)))
  }
}

// ============================================
// LABELS (App Names)
// ============================================

/**
 * Carica un label dalla cache IndexedDB
 */
async function loadLabelFromDb(packageName: string): Promise<string | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(LABELS_STORE, 'readonly')
      const request = tx.objectStore(LABELS_STORE).get(packageName)

      request.onsuccess = () => {
        const label = request.result?.label
        // Validate the label is not garbage
        if (label && isValidCachedLabel(label)) {
          resolve(label)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Verifica che un label dalla cache sia valido (non spazzatura)
 */
function isValidCachedLabel(label: unknown): label is string {
  if (typeof label !== 'string') return false
  if (label.length === 0) return false
  if (label.length > 200) return false

  // Rifiuta valori noti come errati
  const invalidLabels = [
    'null', '"null"', 'undefined', '"undefined"',
    'Not Found', 'not found', 'NOT FOUND',
    '', ' ', 'unknown', 'Unknown'
  ]
  if (invalidLabels.includes(label.trim())) return false

  // Rifiuta se contiene solo whitespace
  if (label.trim().length === 0) return false

  return true
}

/**
 * Salva un label nella cache IndexedDB
 */
async function saveLabelToDb(packageName: string, label: string): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(LABELS_STORE, 'readwrite')
    tx.objectStore(LABELS_STORE).put({
      packageName,
      label,
      timestamp: Date.now()
    })
  } catch (e) {
    console.warn('Errore salvataggio label in IndexedDB:', e)
  }
}

/**
 * Estrae il nome reale di un'app dal dispositivo
 * Usa pm dump che è disponibile su tutti i dispositivi Android
 */
export async function getAppLabel(packageName: string): Promise<string | null> {
  // 1. Check memory cache
  if (labelMemoryCache.has(packageName)) {
    return labelMemoryCache.get(packageName)!
  }

  // Skip if already tried and failed
  if (labelNotFound.has(packageName)) {
    return null
  }

  // 2. Check IndexedDB cache
  const cached = await loadLabelFromDb(packageName)
  if (cached) {
    labelMemoryCache.set(packageName, cached)
    return cached
  }

  // 3. Prova a estrarre dal dispositivo
  try {
    const label = await extractLabelFromDevice(packageName)
    if (label) {
      console.log(`🏷️ Trovato nome: ${packageName} -> ${label}`)
      labelMemoryCache.set(packageName, label)
      saveLabelToDb(packageName, label) // Async, non blocca
      // Upload a Supabase in background
      uploadLabelToSupabase(packageName, label)
      return label
    }
  } catch (e) {
    console.warn(`Errore estrazione label ${packageName}:`, e)
  }

  labelNotFound.add(packageName)
  return null
}

/**
 * Estrae il label dal dispositivo usando vari metodi
 * Compatibile con Android 5+ senza dipendenze esterne
 */
async function extractLabelFromDevice(packageName: string): Promise<string | null> {
  // Check global setting
  if (!getAppSettings().enableDeviceScraping) {
    return null
  }

  try {
    // Metodo 1: pm dump - Il più affidabile su tutti i dispositivi Android
    // Cerca vari pattern possibili per il nome dell'app
    const pmDumpResult = await adbClient.shell(
      `pm dump ${packageName} 2>/dev/null | head -100`
    )

    if (pmDumpResult.stdout) {
      const output = pmDumpResult.stdout

      // Pattern 1: "Application Label: Nome App" (più comune)
      let match = output.match(/Application Label:\s*(.+?)(?:\n|$)/i)
      if (match && match[1]) {
        const label = match[1].trim()
        if (isValidLabel(label, packageName)) {
          return cleanLabel(label)
        }
      }

      // Pattern 2: "labelRes=0x... label=Nome" (Android recenti)
      match = output.match(/\blabel=([^\n\r]+)/i)
      if (match && match[1]) {
        const rawLabel = match[1].trim()
        // Rimuovi eventuali spazi o caratteri finali
        const label = rawLabel.split(/\s{2,}/)[0].trim()
        if (isValidLabel(label, packageName)) {
          return cleanLabel(label)
        }
      }

      // Pattern 3: "nonLocalizedLabel=Nome App"
      match = output.match(/nonLocalizedLabel=([^\n\r]+)/i)
      if (match && match[1]) {
        const label = match[1].trim()
        if (isValidLabel(label, packageName)) {
          return cleanLabel(label)
        }
      }

      // Pattern 4: Cerca nel blocco ActivityInfo il label
      match = output.match(/ActivityInfo\{[^}]*label=([^}\n\r]+)/i)
      if (match && match[1]) {
        const label = match[1].trim()
        if (isValidLabel(label, packageName)) {
          return cleanLabel(label)
        }
      }
    }

    // Metodo 2: Prova aapt se disponibile (più preciso ma meno disponibile)
    const pathResult = await adbClient.shell(`pm path ${packageName} 2>/dev/null | head -1`)
    if (pathResult.stdout.trim()) {
      const apkPath = pathResult.stdout.replace('package:', '').trim()

      // aapt potrebbe essere disponibile su alcuni dispositivi
      const aaptResult = await adbClient.shell(
        `aapt d badging "${apkPath}" 2>/dev/null | grep "application-label" | head -5`
      )

      if (aaptResult.stdout) {
        // Cerca application-label o application-label-*:'Nome'
        const labelMatch = aaptResult.stdout.match(/application-label(?:-[a-z]{2})?:'([^']+)'/)
        if (labelMatch && labelMatch[1]) {
          const label = labelMatch[1].trim()
          if (isValidLabel(label, packageName)) {
            return cleanLabel(label)
          }
        }
      }
    }

  } catch (e) {
    console.warn(`Errore estrazione label per ${packageName}:`, e)
  }

  return null
}

/**
 * Pulisce un label rimuovendo caratteri non necessari
 */
function cleanLabel(label: string): string {
  return label
    .replace(/\s+/g, ' ')  // Normalizza spazi
    .replace(/^\s+|\s+$/g, '')  // Trim
    .replace(/\u0000/g, '')  // Rimuovi caratteri null
}

/**
 * Estrae i label di tutti i pacchetti in batch usando dumpsys
 * Molto più veloce che chiamare pm dump per ogni pacchetto
 */
export async function extractAllLabelsFromDevice(
  packageNames: string[],
  onProgress?: (current: number, total: number, packageName: string, label: string | null) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const notInCache = packageNames.filter(
    pkg => !labelMemoryCache.has(pkg) && !labelNotFound.has(pkg)
  )

  if (notInCache.length === 0) return results

  // Check global setting
  if (!getAppSettings().enableDeviceScraping) {
    console.log('🚫 Estrazione label dal dispositivo disabilitata (impostazioni admin)')
    return results
  }

  console.log(`🔍 Estrazione batch label per ${notInCache.length} pacchetti...`)

  try {
    // Metodo 1: Usa cmd package list-packages con info
    // Questo comando mostra package:label in un formato più strutturato
    const listResult = await adbClient.shell(
      'pm list packages -f 2>/dev/null'
    )

    // Crea una mappa dei path APK per ogni pacchetto
    const apkPaths = new Map<string, string>()
    if (listResult.stdout) {
      const lines = listResult.stdout.split('\n')
      for (const line of lines) {
        // Formato: package:/path/to/app.apk=com.package.name
        const match = line.match(/package:(.+?)=(.+)/)
        if (match) {
          apkPaths.set(match[2].trim(), match[1].trim())
        }
      }
    }

    // Procedi con estrazione batch in piccoli gruppi paralleli
    const batchSize = 5 // Più piccolo per maggiore reattività
    let processed = 0

    for (let i = 0; i < notInCache.length; i += batchSize) {
      const batch = notInCache.slice(i, i + batchSize)

      // Esegui le estrazioni in parallelo per questo batch
      const batchPromises = batch.map(async (pkgName) => {
        // Prima prova dal nostro metodo standard
        const label = await extractLabelFromDevice(pkgName)

        if (label) {
          results.set(pkgName, label)
          labelMemoryCache.set(pkgName, label)
          saveLabelToDb(pkgName, label)
          uploadLabelToSupabase(pkgName, label)
          return { pkgName, label }
        } else {
          labelNotFound.add(pkgName)
          return { pkgName, label: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      processed += batch.length

      // Notifica progresso
      for (const result of batchResults) {
        if (onProgress) {
          onProgress(processed, notInCache.length, result.pkgName, result.label)
        }
      }
    }

    console.log(`✅ Batch label completato: ${results.size} trovati su ${notInCache.length}`)

  } catch (e) {
    console.warn('Errore estrazione batch label:', e)
  }

  return results
}

/**
 * Verifica che il label sia valido e rappresenti un vero nome di app
 */
function isValidLabel(label: string, packageName: string): boolean {
  if (!label || label.length === 0) return false
  if (label.length < 2) return false // Troppo corto
  if (label === packageName) return false

  // Deve iniziare con una lettera o numero
  if (!/^[a-zA-Z0-9\u00C0-\u024F\u1100-\u11FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(label)) return false

  // Rifiuta se è un resource ID hex
  if (label.startsWith('0x') && /^0x[0-9a-fA-F]+$/.test(label)) return false

  // Rifiuta se è solo numeri
  if (/^\d+$/.test(label)) return false

  // Rifiuta se sembra un package name (contiene punti tipici dei package)
  if (/^[a-z]+\.[a-z]+\.[a-z]/.test(label.toLowerCase())) return false

  return true
}

/**
 * Upload label a Supabase per condivisione community
 * Salva il nome dell'app nel campo description.label per recuperarlo facilmente
 * NON salva valori invalidi come 'Not Found' o 'null'
 */
async function uploadLabelToSupabase(packageName: string, label: string): Promise<void> {
  // VALIDAZIONE: non salvare label invalidi
  if (!isValidCachedLabel(label)) {
    console.log(`⚠️ Label invalido per ${packageName}, non salvato: "${label}"`)
    return
  }
  try {
    // Prepara l'oggetto description con il label
    // Controlla se il package è protetto (verificato da admin)
    const { data: existing } = await supabase
      .from('uad_packages')
      .select('description, admin_verified')
      .eq('package_name', packageName)
      .single()

    // Se admin_verified è true, non sovrascrivere
    if (existing?.admin_verified) {
      console.log(`🔒 Package ${packageName} protetto, scraping ignorato`)
      return
    }

    let descriptions: Record<string, string> = {}
    if (existing?.description && typeof existing.description === 'object') {
      descriptions = existing.description as Record<string, string>
    }

    // Se esiste già un label verificato, non sovrascrivere
    if (descriptions['label'] && existing?.admin_verified) {
      return
    }

    // Salva il label nel campo 'label' della description
    descriptions['label'] = label

    // Upsert nel database
    const { error } = await supabase
      .from('uad_packages')
      .upsert({
        package_name: packageName,
        description: descriptions
      }, { onConflict: 'package_name' })

    if (!error) {
      console.log(`📤 Nome app salvato: ${packageName} -> ${label}`)
    }
  } catch (e) {
    // Ignora errori di upload, non bloccare il flusso
    console.warn(`Errore upload label ${packageName}:`, e)
  }
}

/**
 * Ottiene il label dalla cache memory (sincrono)
 * Ritorna null se il label è invalido
 */
export function getCachedLabel(packageName: string): string | null {
  const label = labelMemoryCache.get(packageName)
  if (label && isValidCachedLabel(label)) {
    return label
  }
  return null
}

/**
 * Precarica i labels per una lista di pacchetti
 */
export async function preloadLabels(packageNames: string[], maxConcurrent = 3): Promise<void> {
  // Filtra pacchetti già in cache o già falliti
  const toLoad = packageNames.filter(
    pkg => !labelMemoryCache.has(pkg) && !labelNotFound.has(pkg)
  )

  // Limita per performance
  const limitedLoad = toLoad.slice(0, 30)

  // Carica in batch paralleli
  for (let i = 0; i < limitedLoad.length; i += maxConcurrent) {
    const batch = limitedLoad.slice(i, i + maxConcurrent)
    await Promise.all(batch.map(pkg => getAppLabel(pkg)))
  }
}

// ============================================
// LOAD FROM SUPABASE
// ============================================

/**
 * Carica icone e labels da Supabase per i pacchetti specificati
 * Da chiamare all'avvio per popolare la cache con dati già noti
 */
export async function loadFromSupabase(packageNames: string[]): Promise<void> {
  try {
    // Query che include anche l'icona se disponibile
    const { data, error } = await supabase
      .from('uad_packages')
      .select('package_name, description, icon_base64')
      .in('package_name', packageNames)

    if (error) {
      console.warn('Errore query Supabase:', error)
      return
    }

    if (data) {
      let loadedLabels = 0
      let loadedIcons = 0

      for (const row of data) {
        // Estrai il label dalla description - usa solo il campo 'label' specifico
        if (row.description && typeof row.description === 'object') {
          const desc = row.description as Record<string, string>
          const label = desc['label'] // Solo il campo label, non le descrizioni

          // Verifica che sia un nome valido e non una descrizione o spazzatura
          if (label && !label.includes('\n') && isValidCachedLabel(label) && isValidLabel(label, row.package_name)) {
            labelMemoryCache.set(row.package_name, label)
            saveLabelToDb(row.package_name, label)
            loadedLabels++
          }
        }

        // Carica anche l'icona se presente
        if (row.icon_base64 && !iconMemoryCache.has(row.package_name)) {
          iconMemoryCache.set(row.package_name, row.icon_base64)
          saveIconToDb(row.package_name, row.icon_base64)
          loadedIcons++
        }
      }

      if (loadedLabels > 0 || loadedIcons > 0) {
        console.log(`📦 Caricati da Supabase: ${loadedLabels} nomi app, ${loadedIcons} icone`)
      }
    }
  } catch (e) {
    console.warn('Errore caricamento da Supabase:', e)
  }
}

/**
 * Carica tutte le icone/labels dalla cache IndexedDB in memoria
 * Da chiamare all'avvio per ripristinare la sessione
 */
export async function loadAllFromCache(): Promise<void> {
  try {
    const db = await openDb()

    // Carica icone
    const iconsTx = db.transaction(ICONS_STORE, 'readonly')
    const iconsRequest = iconsTx.objectStore(ICONS_STORE).getAll()
    iconsRequest.onsuccess = () => {
      for (const item of iconsRequest.result || []) {
        if (item.packageName && item.iconData) {
          iconMemoryCache.set(item.packageName, item.iconData)
        }
      }
    }

    // Carica labels
    const labelsTx = db.transaction(LABELS_STORE, 'readonly')
    const labelsRequest = labelsTx.objectStore(LABELS_STORE).getAll()
    labelsRequest.onsuccess = () => {
      for (const item of labelsRequest.result || []) {
        if (item.packageName && item.label) {
          labelMemoryCache.set(item.packageName, item.label)
        }
      }
    }
  } catch (e) {
    console.warn('Errore caricamento cache IndexedDB:', e)
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Genera un colore di fallback basato sul nome del pacchetto
 */
export function getPackageColor(packageName: string): string {
  let hash = 0
  for (let i = 0; i < packageName.length; i++) {
    hash = ((hash << 5) - hash + packageName.charCodeAt(i)) | 0
  }

  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    'bg-rose-500'
  ]

  return colors[Math.abs(hash) % colors.length]
}

/**
 * Ottiene le iniziali del nome dell'app per l'avatar fallback
 */
export function getPackageInitials(displayName: string): string {
  const words = displayName.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return displayName.slice(0, 2).toUpperCase()
}

/**
 * Pulisce la cache
 */
export function clearCache(): void {
  iconMemoryCache.clear()
  labelMemoryCache.clear()
  iconNotFound.clear()
  labelNotFound.clear()
}

/**
 * Restituisce statistiche sulla cache
 */
export function getCacheStats(): {
  icons: { cached: number; notFound: number }
  labels: { cached: number; notFound: number }
} {
  return {
    icons: { cached: iconMemoryCache.size, notFound: iconNotFound.size },
    labels: { cached: labelMemoryCache.size, notFound: labelNotFound.size }
  }
}

/**
 * Registra i pacchetti nuovi nel database uad_packages
 * Crea una riga per ogni pacchetto non ancora presente nel database
 * Così quando l'admin modifica un'app, la riga esiste già
 */
export async function registerNewPackages(packageNames: string[]): Promise<void> {
  try {
    // Prima verifica quali pacchetti esistono già
    const { data: existing } = await supabase
      .from('uad_packages')
      .select('package_name')
      .in('package_name', packageNames)

    const existingNames = new Set(existing?.map(e => e.package_name) || [])

    // Filtra i pacchetti nuovi
    const newPackages = packageNames.filter(name => !existingNames.has(name))

    if (newPackages.length === 0) {
      return
    }

    // Inserisci i nuovi pacchetti con dati minimi
    const packagesToInsert = newPackages.map(package_name => ({
      package_name,
      description: {},
      is_from_uad: false
    }))

    // Inserisci in batch (Supabase gestisce bene batch fino a ~1000)
    const batchSize = 100
    for (let i = 0; i < packagesToInsert.length; i += batchSize) {
      const batch = packagesToInsert.slice(i, i + batchSize)

      const { error } = await supabase
        .from('uad_packages')
        .upsert(batch, {
          onConflict: 'package_name',
          ignoreDuplicates: true
        })

      if (error) {
        console.warn('Errore inserimento batch pacchetti:', error)
      }
    }

    console.log(`📝 Registrati ${newPackages.length} nuovi pacchetti nel database`)
  } catch (e) {
    console.warn('Errore registrazione pacchetti:', e)
  }
}

// ============================================
// PLAY STORE FALLBACK
// ============================================

// Proxy CORS gratuiti - useremo il primo disponibile
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
]

// Pacchetti già provati su Play Store senza successo
const playStoreNotFound = new Set<string>()

/**
 * Ottiene il nome di un'app dal Google Play Store
 * Usa un proxy CORS per funzionare dal browser
 */
async function fetchLabelFromPlayStore(packageName: string): Promise<string | null> {
  // Skip se già fallito
  if (playStoreNotFound.has(packageName)) {
    return null
  }

  const playStoreUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en`

  // Prova ogni proxy fino a che uno funziona
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(playStoreUrl), {
        signal: AbortSignal.timeout(8000) // Timeout 8 secondi
      })

      if (!response.ok) {
        continue
      }

      const html = await response.text()

      // Cerca il nome dell'app nella pagina
      let appName: string | null = null

      // Pattern 1: Titolo della pagina
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        const title = titleMatch[1]
        // Rimuovi il suffisso " - Apps on Google Play"
        appName = title
          .replace(/\s*[-–—]\s*(Apps? on Google Play|App su Google Play|Aplicaciones en Google Play|Apps bei Google Play|Applications sur Google Play).*/i, '')
          .trim()
      }

      // Pattern 2: itemprop="name"
      if (!appName) {
        const itemNameMatch = html.match(/itemprop="name"[^>]*>([^<]+)</i)
        if (itemNameMatch) {
          appName = itemNameMatch[1].trim()
        }
      }

      // Pattern 3: og:title meta tag
      if (!appName) {
        const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        if (ogMatch) {
          appName = ogMatch[1]
            .replace(/\s*[-–—]\s*(Apps? on Google Play).*/i, '')
            .trim()
        }
      }

      if (appName && appName.length >= 2 && appName.length < 100) {
        return appName
      }

    } catch (e) {
      // Timeout o errore di rete, prova il prossimo proxy
      continue
    }
  }

  // Tutti i proxy hanno fallito
  playStoreNotFound.add(packageName)
  return null
}

/**
 * Cerca i nomi delle app dal Google Play Store per i pacchetti senza label
 * Usa rate limiting per evitare di essere bloccati
 */
export async function fetchLabelsFromPlayStore(
  packageNames: string[],
  options: {
    maxPackages?: number
    delayMs?: number
    maxConcurrent?: number
    onProgress?: (current: number, total: number, pkgName: string, label: string | null) => void
  } = {}
): Promise<Map<string, string>> {
  const {
    maxPackages = 30,
    delayMs = 1000,
    maxConcurrent = 2,
    onProgress
  } = options

  const results = new Map<string, string>()

  // 1. Filtra pacchetti già in cache locale o falliti in questa sessione
  const potentialFetch = packageNames
    .filter(pkg => !labelMemoryCache.has(pkg) && !playStoreNotFound.has(pkg))
    .slice(0, maxPackages)

  if (potentialFetch.length === 0) return results

  // 2. Verifica su Supabase chi ha già avuto un tentativo di lookup (per evitare doppie ricerche globali)
  let toFetch: string[] = []
  try {
    const { data: existing } = await supabase
      .from('uad_packages')
      .select('package_name, description')
      .in('package_name', potentialFetch)

    const alreadyChecked = new Set<string>()
    if (existing) {
      for (const row of existing) {
        const desc = row.description as Record<string, string>
        // Se c'è un label o il marcatore di lookup effettuato, saltiamo
        if (desc && (desc['label'] || desc['_store_lookup'])) {
          alreadyChecked.add(row.package_name)
          if (desc['label'] && isValidCachedLabel(desc['label'])) {
            // Se c'è un label valido nel DB, mettiamolo in cache locale
            labelMemoryCache.set(row.package_name, desc['label'])
          }
        }
      }
    }
    toFetch = potentialFetch.filter(p => !alreadyChecked.has(p))
  } catch (e) {
    console.warn('Errore pre-check Supabase per Play Store:', e)
    toFetch = potentialFetch // In caso di errore, prova comunque
  }

  if (toFetch.length === 0) return results

  console.log(`🌐 Cercando ${toFetch.length} nomi app sul Play Store...`)

  let processed = 0
  for (let i = 0; i < toFetch.length; i += maxConcurrent) {
    const batch = toFetch.slice(i, i + maxConcurrent)

    const batchPromises = batch.map(async (pkgName) => {
      const label = await fetchLabelFromPlayStore(pkgName)

      if (label && isValidCachedLabel(label)) {
        results.set(pkgName, label)
        labelMemoryCache.set(pkgName, label)
        saveLabelToDb(pkgName, label)
        await uploadLabelToSupabase(pkgName, label)
      } else {
        // Segniamo sul database che abbiamo cercato e non trovato
        await markStoreLookupDone(pkgName)
        playStoreNotFound.add(pkgName)
      }

      processed++
      if (onProgress) {
        onProgress(processed, toFetch.length, pkgName, label)
      }
    })

    await Promise.all(batchPromises)
    if (i + maxConcurrent < toFetch.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * Segna nel database che il lookup sul Play Store è stato effettuato (anche se fallito)
 */
async function markStoreLookupDone(packageName: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('uad_packages')
      .select('description')
      .eq('package_name', packageName)
      .single()

    let descriptions: Record<string, string> = {}
    if (existing?.description && typeof existing.description === 'object') {
      descriptions = existing.description as Record<string, string>
    }

    // Aggiungi il marcatore di lookup effettuato
    descriptions['_store_lookup'] = 'done'

    await supabase
      .from('uad_packages')
      .upsert({
        package_name: packageName,
        description: descriptions
      }, { onConflict: 'package_name' })
  } catch (e) {
    console.warn(`Errore markStoreLookupDone per ${packageName}:`, e)
  }
}

/**
 * Strategia completa per ottenere i nomi delle app:
 * 1. Prima controlla cache/Supabase
 * 2. Poi estrai dal dispositivo
 * 3. Infine prova il Play Store come fallback
 */
export async function fetchAllMissingLabels(
  packageNames: string[],
  onProgress?: (phase: string, current: number, total: number) => void
): Promise<{ fromDevice: number; fromPlayStore: number }> {
  let fromDevice = 0
  let fromPlayStore = 0

  // Filtra i pacchetti senza label
  const missing = packageNames.filter(pkg => !labelMemoryCache.has(pkg))

  if (missing.length === 0) {
    return { fromDevice: 0, fromPlayStore: 0 }
  }

  // Fase 1: Estrai dal dispositivo
  if (onProgress) onProgress('device', 0, missing.length)

  const deviceResults = await extractAllLabelsFromDevice(missing.slice(0, 50))
  fromDevice = deviceResults.size

  // Fase 2: Play Store per i rimanenti
  const stillMissing = missing.filter(pkg => !labelMemoryCache.has(pkg))

  if (stillMissing.length > 0) {
    if (onProgress) onProgress('playstore', 0, stillMissing.length)

    const playStoreResults = await fetchLabelsFromPlayStore(stillMissing.slice(0, 20), {
      maxPackages: 20,
      delayMs: 1500,
      onProgress: (current, total) => {
        if (onProgress) onProgress('playstore', current, total)
      }
    })
    fromPlayStore = playStoreResults.size
  }

  return { fromDevice, fromPlayStore }
}

