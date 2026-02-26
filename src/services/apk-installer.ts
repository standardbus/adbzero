/**
 * APK Installer Service
 * Gestisce il download e l'installazione di APK via ADB
 */

import { shell, pushFile } from './adb-client'
import {
  validatePackageName,
  validateFilePath,
  escapeShellArg
} from './command-sanitizer'

export interface ApkSource {
  name: string
  url: string
  type: 'fdroid' | 'github' | 'direct'
}

export interface InstallProgress {
  stage: 'downloading' | 'pushing' | 'installing' | 'verifying' | 'complete' | 'error'
  progress: number // 0-100
  message: string
}

export type ProgressCallback = (progress: InstallProgress) => void

/**
 * Scarica un APK da URL
 */
async function downloadApk(
  url: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  onProgress?.({
    stage: 'downloading',
    progress: 0,
    message: 'Inizializzazione download...'
  })

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    chunks.push(value)
    received += value.length

    if (total > 0) {
      onProgress?.({
        stage: 'downloading',
        progress: Math.round((received / total) * 100),
        message: `Scaricamento: ${formatBytes(received)} / ${formatBytes(total)}`
      })
    } else {
      onProgress?.({
        stage: 'downloading',
        progress: 50,
        message: `Scaricamento: ${formatBytes(received)}`
      })
    }
  }

  const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' })

  onProgress?.({
    stage: 'downloading',
    progress: 100,
    message: 'Download completato'
  })

  return blob
}

/**
 * Installa un APK sul dispositivo via ADB
 */
export async function installApk(
  source: ApkSource,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Download APK
    const apkBlob = await downloadApk(source.url, onProgress)

    // 2. Convert Blob to ArrayBuffer
    const arrayBuffer = await apkBlob.arrayBuffer()
    const apkData = new Uint8Array(arrayBuffer)

    // 3. Generate temp filename - use timestamp only (no user input)
    const tempPath = `/data/local/tmp/adbzero_${Date.now()}.apk`

    // 4. Push APK to device
    onProgress?.({
      stage: 'pushing',
      progress: 0,
      message: 'Trasferimento APK sul dispositivo...'
    })

    await pushFile(apkData, tempPath, (progress) => {
      onProgress?.({
        stage: 'pushing',
        progress: Math.round(progress * 100),
        message: `Trasferimento: ${Math.round(progress * 100)}%`
      })
    })

    // 5. Install APK
    onProgress?.({
      stage: 'installing',
      progress: 50,
      message: 'Installazione in corso...'
    })

    const safeTempPath = validateFilePath(tempPath, ['/data/local/tmp/'])

    const installResult = await shell(`pm install -r "${escapeShellArg(safeTempPath)}"`)

    // 6. Clean up temp file
    await shell(`rm "${escapeShellArg(safeTempPath)}"`)

    // 7. Check result
    if (installResult.stdout.toLowerCase().includes('success')) {
      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: `${source.name} installato con successo!`
      })

      return { success: true, message: `${source.name} installato con successo!` }
    } else {
      throw new Error(installResult.stderr || installResult.stdout || 'Install failed')
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    onProgress?.({
      stage: 'error',
      progress: 0,
      message: `Errore: ${errorMessage}`
    })

    return { success: false, message: errorMessage }
  }
}

/**
 * Verifica se un pacchetto è installato
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    const safeName = validatePackageName(packageName)
    const result = await shell(`pm list packages | grep ${safeName}`)
    return result.stdout.includes(safeName)
  } catch {
    return false
  }
}

/**
 * Ottiene la versione installata di un pacchetto
 */
export async function getPackageVersion(packageName: string): Promise<string | null> {
  try {
    const safeName = validatePackageName(packageName)
    const result = await shell(`dumpsys package ${safeName} | grep versionName`)
    const match = result.stdout.match(/versionName=([^\s]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Disinstalla un pacchetto
 */
export async function uninstallPackage(packageName: string): Promise<boolean> {
  try {
    const safeName = validatePackageName(packageName)
    const result = await shell(`pm uninstall ${safeName}`)
    return result.stdout.toLowerCase().includes('success')
  } catch {
    return false
  }
}

/**
 * Ottiene l'URL diretto per F-Droid
 * F-Droid usa un pattern prevedibile per i link APK
 */
export async function getFdroidDirectUrl(packageName: string): Promise<string | null> {
  try {
    // Fetch package info from F-Droid API
    const response = await fetch(`https://f-droid.org/api/v1/packages/${packageName}`)

    if (!response.ok) return null

    const data = await response.json()

    if (data.packages && data.packages.length > 0) {
      // Get the latest version
      const latest = data.packages[0]
      return `https://f-droid.org/repo/${latest.apkName}`
    }

    return null
  } catch {
    return null
  }
}

/**
 * Ottiene l'URL dell'ultimo release da GitHub
 */
export async function getGithubReleaseUrl(
  owner: string,
  repo: string,
  assetPattern?: RegExp
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    )

    if (!response.ok) return null

    const data = await response.json()

    if (data.assets && data.assets.length > 0) {
      // Find APK asset
      const apkAsset = data.assets.find((asset: any) => {
        const name = asset.name.toLowerCase()
        if (!name.endsWith('.apk')) return false
        if (assetPattern && !assetPattern.test(name)) return false
        // Prefer arm64 or universal
        if (name.includes('arm64') || name.includes('universal') || !name.includes('arm')) {
          return true
        }
        return false
      }) || data.assets.find((asset: any) =>
        asset.name.toLowerCase().endsWith('.apk')
      )

      return apkAsset?.browser_download_url || null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Utility per formattare bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Batch install multiple APKs
 */
export async function batchInstallApks(
  sources: ApkSource[],
  onProgress?: (current: number, total: number, source: ApkSource, progress: InstallProgress) => void
): Promise<{ success: ApkSource[]; failed: { source: ApkSource; error: string }[] }> {
  const success: ApkSource[] = []
  const failed: { source: ApkSource; error: string }[] = []

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]

    const result = await installApk(source, (progress) => {
      onProgress?.(i + 1, sources.length, source, progress)
    })

    if (result.success) {
      success.push(source)
    } else {
      failed.push({ source, error: result.message })
    }

    // Small delay between installations
    await new Promise(r => setTimeout(r, 500))
  }

  return { success, failed }
}

