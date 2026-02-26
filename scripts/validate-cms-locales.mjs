import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const localesDir = path.join(rootDir, 'src', 'locales')

const localeFiles = [
  'en.ts',
  'it.ts',
  'es.ts',
  'de.ts',
  'fr.ts',
  'zh.ts',
  'ja.ts',
  'ru.ts',
  'ar.ts',
  'hi.ts',
  'bn.ts',
  'id.ts',
  'pt-BR.ts'
]

function findCmsBlock(source) {
  const marker = 'cms: {'
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    return null
  }

  let i = markerIndex + marker.length - 1
  let depth = 0
  let inString = false
  let escaped = false
  let quote = "'"

  for (; i < source.length; i += 1) {
    const ch = source[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        inString = false
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === '{') {
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        const start = markerIndex + marker.length
        return source.slice(start, i)
      }
    }
  }

  return null
}

function extractTopLevelKeys(block) {
  const keys = new Set()
  const re = /^\s*([a-zA-Z0-9_]+)\s*:/gm
  let match = re.exec(block)
  while (match) {
    keys.add(match[1])
    match = re.exec(block)
  }
  return keys
}

async function readLocaleKeys(fileName) {
  const filePath = path.join(localesDir, fileName)
  const source = await fs.readFile(filePath, 'utf8')
  const cmsBlock = findCmsBlock(source)
  if (!cmsBlock) {
    throw new Error(`Missing cms block in ${fileName}`)
  }
  return extractTopLevelKeys(cmsBlock)
}

async function main() {
  const baseKeys = await readLocaleKeys('en.ts')
  let hasErrors = false

  for (const fileName of localeFiles) {
    const keys = await readLocaleKeys(fileName)
    const missing = [...baseKeys].filter((key) => !keys.has(key))
    if (missing.length > 0) {
      hasErrors = true
      console.error(`[cms-i18n] Missing keys in ${fileName}: ${missing.join(', ')}`)
    }
  }

  if (hasErrors) {
    process.exitCode = 1
    return
  }

  console.log('[cms-i18n] All CMS keys present in all locales.')
}

main().catch((error) => {
  console.error('[cms-i18n] Validation failed:', error?.message || error)
  process.exitCode = 1
})
