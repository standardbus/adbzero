import { validatePackageName } from './command-sanitizer'

export interface CsvRow {
    packageId: string
    name: string
    description: string
    level: string
}

/**
 * Sanitizes a string to prevent XSS and other injection attacks
 */
function sanitizeString(str: string): string {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .substring(0, 1024) // Cap length for safety
}

/**
 * Downloads a CSV file
 */
export function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

/**
 * Generates CSV content from a list of packages
 */
export function generatePackagesCsv(nickname: string, rows: CsvRow[], device?: { manufacturer: string, model: string }): string {
    let header = `Nickname: ${nickname}`
    if (device) {
        header += `\nDevice: ${device.manufacturer} ${device.model}`
    }
    header += `\nPackage ID,App Name,Description,Experience Level`
    const csvRows = rows.map(row => {
        // Escape quotes and wrap in quotes if necessary
        const escape = (text: string) => `"${(text || '').replace(/"/g, '""')}"`
        return [
            escape(row.packageId),
            escape(row.name),
            escape(row.description),
            escape(row.level)
        ].join(',')
    })
    return [header, ...csvRows].join('\n')
}

/**
 * Parses a CSV file
 */
export async function parseDebloatCsv(file: File): Promise<{ nickname: string, rows: CsvRow[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result as string
            if (!text) {
                reject(new Error('Empty file'))
                return
            }

            const lines = text.split(/\r?\n/)
            if (lines.length < 2) {
                reject(new Error('Invalid CSV format'))
                return
            }

            // Extract nickname from first line: "Nickname: [name]"
            const nicknameLine = lines[0]
            const nicknameMatch = nicknameLine.match(/Nickname:\s*(.*)/i)
            const nickname = nicknameMatch ? nicknameMatch[1].trim() : 'Anonymous'

            const rows: CsvRow[] = []
            // Skip header and nickname lines
            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim()
                if (!line) continue

                // Basic CSV parser (handles quoted fields)
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
                if (parts && parts.length >= 1) {
                    try {
                        const clean = (s: string) => s.replace(/^"|"$/g, '').replace(/""/g, '"')

                        // Security 1: Validate package name structure
                        const pkgId = validatePackageName(clean(parts[0]))

                        // Security 2: Sanitize readable text
                        const name = sanitizeString(parts[1] ? clean(parts[1]) : '')
                        const description = sanitizeString(parts[2] ? clean(parts[2]) : '')

                        // Security 3: Validate level enum
                        let level = parts[3] ? clean(parts[3]) : 'Recommended'
                        if (!['Recommended', 'Advanced', 'Expert', 'Unsafe'].includes(level)) {
                            level = 'Recommended'
                        }

                        rows.push({
                            packageId: pkgId,
                            name,
                            description,
                            level
                        })
                    } catch (err) {
                        console.warn('Skipping malformed CSV row:', err)
                        // Continuiamo con le altre righe se possibile
                    }
                }
            }

            if (rows.length === 0) {
                reject(new Error('No valid package rows found in CSV'))
                return
            }

            resolve({ nickname, rows })
        }
        reader.onerror = () => reject(new Error('File reading error'))
        reader.readAsText(file)
    })
}
