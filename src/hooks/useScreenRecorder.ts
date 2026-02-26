import { useState, useRef, useCallback } from 'react'

export function useScreenRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [recordingDuration, setRecordingDuration] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<number | null>(null)

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)

            if (timerRef.current) {
                window.clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [isRecording])

    const startRecording = useCallback((canvas: HTMLCanvasElement, fileName: string = 'adbloater-record') => {
        if (isRecording) return

        chunksRef.current = []
        const stream = canvas.captureStream(30) // 30 FPS

        // Try to find a supported mime type
        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ]

        const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type))

        try {
            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${fileName}-${new Date().getTime()}.webm`
                a.click()
                URL.revokeObjectURL(url)
                setRecordingDuration(0)
            }

            recorder.start()
            setIsRecording(true)
            setRecordingDuration(0)

            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1)
            }, 1000)
        } catch (err) {
            console.error('Failed to start recording:', err)
        }
    }, [isRecording])

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return {
        isRecording,
        recordingDuration,
        formatDuration: () => formatDuration(recordingDuration),
        startRecording,
        stopRecording
    }
}
