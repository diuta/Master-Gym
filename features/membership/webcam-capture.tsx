"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CircleAlert, RotateCcw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

// Server Actions default to a 1MB body, so the photo is capped at 960px / 0.85 quality.
const MAX_SIDE = 960

function errorMessage(err: unknown): string {
  switch (err instanceof DOMException ? err.name : "") {
    case "NotAllowedError":
      return "Akses kamera ditolak. Klik ikon kamera di address bar browser, pilih Izinkan, lalu Coba Lagi."
    case "NotFoundError":
      return "Kamera tidak ditemukan. Pastikan webcam terpasang."
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu Coba Lagi."
    default:
      return "Kamera tidak bisa dibuka. Buka aplikasi lewat localhost atau HTTPS."
  }
}

export function WebcamCapture({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const hasValue = value !== null

  // The stream and the <video> can arrive in either order (Coba Lagi remounts the
  // video while getUserMedia may already have resolved), so whichever comes second attaches.
  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video
    if (video && streamRef.current) video.srcObject = streamRef.current
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (hasValue) return
    let cancelled = false

    async function start() {
      try {
        // Missing mediaDevices (insecure context) falls into the generic message.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      }
    }
    start()

    return () => {
      cancelled = true
      stopCamera()
      // Cleanup runs before every restart, so `ready` can't be stale when a camera starts.
      setReady(false)
    }
  }, [hasValue, attempt])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopCamera()
    onChange(canvas.toDataURL("image/jpeg", 0.85))
  }

  function retry() {
    // Batched: the <video> mounts in the same render that restarts the camera.
    setError(null)
    setAttempt((n) => n + 1)
  }

  if (value) {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
        <img
          src={value}
          alt="Foto member"
          className="aspect-video w-full rounded-lg border bg-muted object-cover"
        />
        <Button type="button" variant="outline" size="xl" onClick={() => onChange(null)}>
          <RotateCcw />
          Ulangi
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Kamera tidak tersedia</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" size="xl" onClick={retry}>
          <RotateCcw />
          Coba Lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <video
        ref={attachVideo}
        autoPlay
        playsInline
        muted
        aria-label="Pratinjau kamera"
        onLoadedData={() => setReady(true)}
        className="aspect-video w-full rounded-lg border bg-muted object-cover"
      />
      <Button type="button" size="xl" onClick={capture} disabled={!ready}>
        <Camera />
        {ready ? "Ambil Foto" : "Membuka kamera..."}
      </Button>
    </div>
  )
}
