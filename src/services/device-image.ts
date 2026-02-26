/**
 * Device Image Service
 * Cerca, scarica e cacha immagini dei dispositivi Android
 * 
 * Fonti utilizzate:
 * 1. Cache locale (Supabase Storage)
 * 2. GSMArena (via URL pattern)
 * 3. PhoneDB
 * 4. Placeholder SVG come fallback
 */

import { supabase } from './supabase'

export interface DeviceImageResult {
  imageUrl: string | null
  source: 'cache' | 'gsmarena' | 'phonedb' | 'placeholder'
  isPlaceholder: boolean
}

// Cache in memoria per evitare richieste ripetute
const memoryCache = new Map<string, DeviceImageResult>()

/**
 * Normalizza il nome del dispositivo per la ricerca
 */
function normalizeDeviceKey(manufacturer: string, model: string): string {
  return `${manufacturer}_${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Genera URL GSMArena basato su manufacturer e model
 * GSMArena usa un pattern: brand-model-name.jpg
 */
function getGSMArenaUrl(manufacturer: string, model: string): string[] {
  const brand = manufacturer.toLowerCase()
  const modelSlug = model
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // GSMArena ha diversi pattern per le immagini
  return [
    `https://fdn2.gsmarena.com/vv/bigpic/${brand}-${modelSlug}.jpg`,
    `https://fdn2.gsmarena.com/vv/bigpic/${brand}_${modelSlug}.jpg`,
    `https://fdn.gsmarena.com/imgroot/reviews/-${brand}-${modelSlug}/lifestyle/-design/${brand}-${modelSlug}-lifestyle.jpg`,
  ]
}

/**
 * Genera URL per DeviceAtlas / Device Specifications
 */
function getDeviceSpecsUrl(manufacturer: string, model: string): string[] {
  const slug = `${manufacturer}_${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')

  return [
    `https://www.devicespecifications.com/images/model/${slug}.jpg`,
    `https://www.kimovil.com/media/phones/${slug}.jpg`,
  ]
}

/**
 * Prova a scaricare l'immagine da un URL
 */
async function fetchImage(url: string): Promise<Blob | null> {
  try {
    // Per evitare problemi CORS, usiamo un proxy o fetch diretto
    const response = await fetch(url)
    
    if (!response.ok) {
      return null
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType?.startsWith('image/')) {
      return null
    }
    
    return await response.blob()
  } catch (error) {
    console.warn(`Failed to fetch image from ${url}:`, error)
    return null
  }
}

/**
 * Carica immagine su Supabase Storage
 */
async function uploadToStorage(
  blob: Blob,
  deviceKey: string,
  format: string
): Promise<string | null> {
  try {
    const fileName = `${deviceKey}.${format}`
    const filePath = `device-images/${fileName}`
    
    const { error } = await supabase.storage
      .from('device-images')
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: true
      })
    
    if (error) {
      console.error('Storage upload error:', error)
      return null
    }
    
    // Ottieni URL pubblico
    const { data: publicData } = supabase.storage
      .from('device-images')
      .getPublicUrl(filePath)
    
    return publicData.publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    return null
  }
}

/**
 * Salva immagine nel database
 */
async function saveToDatabase(
  manufacturer: string,
  model: string,
  imageUrl: string,
  sourceUrl: string,
  sourceName: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('save_device_image', {
      p_manufacturer: manufacturer,
      p_model: model,
      p_image_url: imageUrl,
      p_source_url: sourceUrl,
      p_source_name: sourceName
    })
    
    if (error) {
      console.error('Database save error:', error)
    }
  } catch (error) {
    console.error('Save error:', error)
  }
}

/**
 * Registra errore di fetch nel database
 */
async function markFetchError(
  manufacturer: string,
  model: string,
  error: string
): Promise<void> {
  try {
    await supabase.rpc('mark_device_image_fetch_error', {
      p_manufacturer: manufacturer,
      p_model: model,
      p_error: error
    })
  } catch (e) {
    console.error('Mark error failed:', e)
  }
}

/**
 * Controlla se l'immagine è già in cache (database)
 */
async function checkDatabaseCache(
  manufacturer: string,
  model: string
): Promise<{ imageUrl: string | null; needsFetch: boolean }> {
  try {
    const { data, error } = await supabase.rpc('get_or_create_device_image', {
      p_manufacturer: manufacturer,
      p_model: model
    })
    
    if (error || !data || data.length === 0) {
      return { imageUrl: null, needsFetch: true }
    }
    
    return {
      imageUrl: data[0].image_url,
      needsFetch: data[0].needs_fetch
    }
  } catch {
    return { imageUrl: null, needsFetch: true }
  }
}

/**
 * Genera un placeholder SVG per il dispositivo
 */
function generatePlaceholderSvg(manufacturer: string, model: string): string {
  // Colori basati sul manufacturer per varietà visiva
  const colors: Record<string, { bg: string; accent: string }> = {
    samsung: { bg: '#1428A0', accent: '#fff' },
    xiaomi: { bg: '#FF6900', accent: '#fff' },
    huawei: { bg: '#CF0A2C', accent: '#fff' },
    oppo: { bg: '#1BA548', accent: '#fff' },
    vivo: { bg: '#415FFF', accent: '#fff' },
    realme: { bg: '#FFD300', accent: '#000' },
    oneplus: { bg: '#F5010C', accent: '#fff' },
    google: { bg: '#4285F4', accent: '#fff' },
    motorola: { bg: '#5C92FA', accent: '#fff' },
    lg: { bg: '#A50034', accent: '#fff' },
    sony: { bg: '#000000', accent: '#fff' },
    nokia: { bg: '#124191', accent: '#fff' },
    asus: { bg: '#00539B', accent: '#fff' },
    honor: { bg: '#0AB4E2', accent: '#fff' },
    default: { bg: '#6366f1', accent: '#fff' }
  }
  
  const mfr = manufacturer.toLowerCase()
  const color = colors[mfr] || colors.default
  const initial = manufacturer.charAt(0).toUpperCase()
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400" width="200" height="400">
      <defs>
        <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color.bg};stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:${color.bg};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
      </defs>
      
      <!-- Phone body -->
      <rect x="20" y="20" width="160" height="360" rx="24" ry="24" 
            fill="#1a1a1a" filter="url(#shadow)"/>
      
      <!-- Screen -->
      <rect x="28" y="40" width="144" height="300" rx="8" ry="8" 
            fill="url(#screenGrad)"/>
      
      <!-- Camera notch/punch hole -->
      <circle cx="100" cy="60" r="6" fill="#0a0a0a"/>
      
      <!-- Brand initial -->
      <text x="100" y="200" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="72" 
            font-weight="bold" 
            fill="${color.accent}" 
            text-anchor="middle" 
            dominant-baseline="middle"
            opacity="0.9">
        ${initial}
      </text>
      
      <!-- Model name (truncated) -->
      <text x="100" y="280" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="14" 
            fill="${color.accent}" 
            text-anchor="middle"
            opacity="0.7">
        ${model.length > 20 ? model.substring(0, 17) + '...' : model}
      </text>
      
      <!-- Bottom bar (navigation) -->
      <rect x="70" y="355" width="60" height="4" rx="2" fill="#333"/>
    </svg>
  `.trim()
  
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Ottieni l'immagine del dispositivo
 * Cerca prima in cache, poi online, poi usa placeholder
 */
export async function getDeviceImage(
  manufacturer: string,
  model: string
): Promise<DeviceImageResult> {
  const deviceKey = normalizeDeviceKey(manufacturer, model)
  
  // 1. Check memory cache
  if (memoryCache.has(deviceKey)) {
    return memoryCache.get(deviceKey)!
  }
  
  // 2. Check database cache
  const cacheResult = await checkDatabaseCache(manufacturer, model)
  
  if (cacheResult.imageUrl) {
    const result: DeviceImageResult = {
      imageUrl: cacheResult.imageUrl,
      source: 'cache',
      isPlaceholder: false
    }
    memoryCache.set(deviceKey, result)
    return result
  }
  
  // 3. Se non serve fetch (troppi tentativi falliti), usa placeholder
  if (!cacheResult.needsFetch) {
    const placeholder = generatePlaceholderSvg(manufacturer, model)
    const result: DeviceImageResult = {
      imageUrl: placeholder,
      source: 'placeholder',
      isPlaceholder: true
    }
    memoryCache.set(deviceKey, result)
    return result
  }
  
  // 4. Prova a scaricare da fonti online
  const sources = [
    { name: 'gsmarena', urls: getGSMArenaUrl(manufacturer, model) },
    { name: 'devicespecs', urls: getDeviceSpecsUrl(manufacturer, model) },
  ]
  
  for (const source of sources) {
    for (const url of source.urls) {
      try {
        const blob = await fetchImage(url)
        
        if (blob && blob.size > 1000) { // Minimo 1KB per essere valida
          // Upload to Supabase Storage
          const format = blob.type.split('/')[1] || 'jpg'
          const storageUrl = await uploadToStorage(blob, deviceKey, format)
          
          if (storageUrl) {
            // Save to database
            await saveToDatabase(manufacturer, model, storageUrl, url, source.name)
            
            const result: DeviceImageResult = {
              imageUrl: storageUrl,
              source: source.name as any,
              isPlaceholder: false
            }
            memoryCache.set(deviceKey, result)
            return result
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${source.name}:`, error)
      }
    }
  }
  
  // 5. Nessuna immagine trovata, registra errore e usa placeholder
  await markFetchError(manufacturer, model, 'No image found from any source')
  
  const placeholder = generatePlaceholderSvg(manufacturer, model)
  const result: DeviceImageResult = {
    imageUrl: placeholder,
    source: 'placeholder',
    isPlaceholder: true
  }
  memoryCache.set(deviceKey, result)
  return result
}

/**
 * Precarica immagine del dispositivo in background
 */
export function prefetchDeviceImage(manufacturer: string, model: string): void {
  // Avvia il fetch in background senza attendere
  getDeviceImage(manufacturer, model).catch(console.warn)
}

/**
 * Pulisci la cache in memoria
 */
export function clearImageCache(): void {
  memoryCache.clear()
}

