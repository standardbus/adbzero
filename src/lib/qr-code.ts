/**
 * QR Code Generation Library
 * Internal utility for generating QR codes from any string.
 * Can be called from anywhere in the webapp.
 */

import QRCode from 'qrcode'

export interface QRCodeOptions {
    /** Width/height of the QR code in pixels */
    size?: number
    /** Margin around the QR code (in modules) */
    margin?: number
    /** Dark color (foreground) */
    darkColor?: string
    /** Light color (background) */
    lightColor?: string
    /** Error correction level: 'L' (7%), 'M' (15%), 'Q' (25%), 'H' (30%) */
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

const DEFAULT_OPTIONS: QRCodeOptions = {
    size: 200,
    margin: 2,
    darkColor: '#000000',
    lightColor: '#ffffff',
    errorCorrectionLevel: 'M'
}

/**
 * Generates a QR code as a Data URL (base64 PNG image)
 * @param data - The string to encode in the QR code
 * @param options - Optional configuration for the QR code
 * @returns Promise<string> - Data URL of the generated QR code image
 */
export async function generateQRCode(
    data: string,
    options: QRCodeOptions = {}
): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    try {
        const dataUrl = await QRCode.toDataURL(data, {
            width: opts.size,
            margin: opts.margin,
            color: {
                dark: opts.darkColor,
                light: opts.lightColor
            },
            errorCorrectionLevel: opts.errorCorrectionLevel
        })
        return dataUrl
    } catch (error) {
        console.error('Failed to generate QR code:', error)
        throw new Error('QR code generation failed')
    }
}

/**
 * Generates a QR code as an SVG string
 * @param data - The string to encode in the QR code
 * @param options - Optional configuration for the QR code
 * @returns Promise<string> - SVG markup of the generated QR code
 */
export async function generateQRCodeSVG(
    data: string,
    options: QRCodeOptions = {}
): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    try {
        const svg = await QRCode.toString(data, {
            type: 'svg',
            width: opts.size,
            margin: opts.margin,
            color: {
                dark: opts.darkColor,
                light: opts.lightColor
            },
            errorCorrectionLevel: opts.errorCorrectionLevel
        })
        return svg
    } catch (error) {
        console.error('Failed to generate QR code SVG:', error)
        throw new Error('QR code SVG generation failed')
    }
}
