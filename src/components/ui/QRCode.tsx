/**
 * QRCode Component
 * Reusable React component for displaying QR codes.
 * Uses the internal QR code generation library.
 */

import { useState, useEffect, memo } from 'react'
import { generateQRCode, QRCodeOptions } from '@/lib/qr-code'
import { Loader2 } from 'lucide-react'

export interface QRCodeProps extends QRCodeOptions {
    /** The data/URL to encode in the QR code */
    data: string
    /** Alt text for accessibility */
    alt?: string
    /** Additional CSS class names */
    className?: string
    /** Whether to show a loading spinner while generating */
    showLoader?: boolean
}

/**
 * QRCode display component
 * Generates and displays a QR code from the provided data string.
 */
export const QRCode = memo(function QRCode({
    data,
    alt = 'QR Code',
    className = '',
    showLoader = true,
    size = 150,
    margin = 2,
    darkColor = '#000000',
    lightColor = '#ffffff',
    errorCorrectionLevel = 'M'
}: QRCodeProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true

        async function generate() {
            if (!data) {
                setQrDataUrl(null)
                setIsLoading(false)
                return
            }

            setIsLoading(true)
            setError(null)

            try {
                const dataUrl = await generateQRCode(data, {
                    size,
                    margin,
                    darkColor,
                    lightColor,
                    errorCorrectionLevel
                })

                if (mounted) {
                    setQrDataUrl(dataUrl)
                    setIsLoading(false)
                }
            } catch (err) {
                if (mounted) {
                    setError('Failed to generate QR code')
                    setIsLoading(false)
                }
            }
        }

        generate()

        return () => {
            mounted = false
        }
    }, [data, size, margin, darkColor, lightColor, errorCorrectionLevel])

    // Loading state
    if (isLoading && showLoader) {
        return (
            <div
                className={`flex items-center justify-center ${className}`}
                style={{ width: size, height: size }}
            >
                <Loader2 className="w-8 h-8 animate-spin text-surface-400" />
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div
                className={`flex items-center justify-center bg-red-500/10 rounded-lg text-red-500 text-xs ${className}`}
                style={{ width: size, height: size }}
            >
                {error}
            </div>
        )
    }

    // No data
    if (!qrDataUrl) {
        return null
    }

    // Render QR code
    return (
        <img
            src={qrDataUrl}
            alt={alt}
            width={size}
            height={size}
            className={`rounded-lg ${className}`}
            style={{ imageRendering: 'pixelated' }}
        />
    )
})

export default QRCode
