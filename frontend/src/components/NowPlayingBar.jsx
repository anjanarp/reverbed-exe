import { useEffect, useLayoutEffect, useRef, useState } from "react"

import playerBar from "../assets/player-bar.png"
import discImage from "../assets/disc.png"
import { getEffectSettings } from "../audio/effectSettings"

const SPECTRUM_BANDS = 10
const SPECTRUM_SEGMENTS = 8
// degrees per second the disc turns at normal speed
const DISC_SPIN_SPEED = 220

function formatClock(seconds) {
    if (!Number.isFinite(seconds)) return "--:--"

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function PrevIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="3" height="14" />
            <path d="M20 5 L9 12 L20 19 Z" />
        </svg>
    )
}

function NextIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5 L15 12 L4 19 Z" />
            <rect x="17" y="5" width="3" height="14" />
        </svg>
    )
}

function PlayPauseIcon({ isPlaying }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {isPlaying ? (
                <>
                    <rect x="6" y="5" width="4" height="14" />
                    <rect x="14" y="5" width="4" height="14" />
                </>
            ) : (
                <path d="M7 4 L20 12 L7 20 Z" />
            )}
        </svg>
    )
}

function NowPlayingBar({
    playerRef,
    track,
    controls,
    canGoPrevious,
    canGoNext,
    onPrevious,
    onNext
}) {
    const [isPlaying, setIsPlaying] = useState(false)

    const timeRef = useRef(null)
    const canvasRef = useRef(null)
    const discRef = useRef(null)
    const glowRef = useRef(null)
    const nameBoxRef = useRef(null)
    const nameTextRef = useRef(null)

    const playbackRate = getEffectSettings(controls).playbackRate
    const playbackRateRef = useRef(playbackRate)

    useEffect(() => {
        playbackRateRef.current = playbackRate
    }, [playbackRate])

    // long titles scroll across the screen like an old LCD
    useLayoutEffect(() => {
        const box = nameBoxRef.current
        const text = nameTextRef.current
        const overflow = text.scrollWidth - box.clientWidth

        text.style.setProperty("--scroll-distance", `${-overflow}px`)
        text.classList.toggle("now-playing-name-scroll", overflow > 0)
    }, [track])

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        let frame
        let lastTime = performance.now()
        let angle = 0
        let spinSpeed = 0
        let playing = false
        const levels = new Array(SPECTRUM_BANDS).fill(0)

        function drawSpectrum() {
            const width = canvas.width
            const height = canvas.height
            const gap = 2
            const bandWidth = (width - gap * (SPECTRUM_BANDS - 1)) / SPECTRUM_BANDS
            const segmentHeight = (height - gap * (SPECTRUM_SEGMENTS - 1)) / SPECTRUM_SEGMENTS

            context.clearRect(0, 0, width, height)

            for (let band = 0; band < SPECTRUM_BANDS; band++) {
                const lit = Math.round(levels[band] * SPECTRUM_SEGMENTS)

                for (let segment = 0; segment < SPECTRUM_SEGMENTS; segment++) {
                    const x = band * (bandWidth + gap)
                    const y = height - (segment + 1) * segmentHeight - segment * gap

                    if (segment < lit) {
                        context.fillStyle = segment >= SPECTRUM_SEGMENTS - 2 ? "#f0abfc" : "#c084fc"
                        context.shadowColor = "#d946ef"
                        context.shadowBlur = 4
                    } else {
                        context.fillStyle = "rgba(124, 58, 237, 0.18)"
                        context.shadowBlur = 0
                    }

                    context.fillRect(x, y, bandWidth, segmentHeight)
                }
            }
        }

        function tick(now) {
            const delta = Math.min(0.1, (now - lastTime) / 1000)
            lastTime = now

            const wavesurfer = playerRef.current.getWaveSurfer?.()
            const analyser = playerRef.current.getAnalyser?.()
            const nowPlaying = Boolean(wavesurfer?.isPlaying())

            if (nowPlaying !== playing) {
                playing = nowPlaying
                setIsPlaying(nowPlaying)
            }

            timeRef.current.textContent = wavesurfer
                ? `${formatClock(wavesurfer.getCurrentTime())} / ${formatClock(wavesurfer.getDuration())}`
                : "--:-- / --:--"

            // fft bins are in dB; spread the bands across the low/mid range where music lives
            let bass = 0

            if (analyser && playing) {
                const values = analyser.getValue()

                for (let band = 0; band < SPECTRUM_BANDS; band++) {
                    const start = Math.floor(Math.pow(band / SPECTRUM_BANDS, 1.6) * 40)
                    const end = Math.max(start + 1, Math.floor(Math.pow((band + 1) / SPECTRUM_BANDS, 1.6) * 40))
                    let sum = 0

                    for (let bin = start; bin < end; bin++) sum += values[bin]

                    const level = Math.min(1, Math.max(0, (sum / (end - start) + 90) / 65))

                    levels[band] = Math.max(level, levels[band] - delta * 2.2)
                }

                bass = Math.min(1, Math.max(0, ((values[1] + values[2]) / 2 + 60) / 45))
            } else {
                for (let band = 0; band < SPECTRUM_BANDS; band++) {
                    levels[band] = Math.max(0, levels[band] - delta * 2.2)
                }
            }

            drawSpectrum()

            // the disc eases up to speed and coasts to a stop instead of snapping
            const targetSpeed = playing ? DISC_SPIN_SPEED * playbackRateRef.current : 0
            spinSpeed += (targetSpeed - spinSpeed) * Math.min(1, delta * 2.5)
            angle = (angle + spinSpeed * delta) % 360

            discRef.current.style.transform = `rotate(${angle}deg)`
            glowRef.current.style.opacity = playing ? 0.15 + bass * 0.85 : 0

            frame = requestAnimationFrame(tick)
        }

        frame = requestAnimationFrame(tick)

        return () => cancelAnimationFrame(frame)
    }, [playerRef])

    function handlePlayPause() {
        playerRef.current.getWaveSurfer?.()?.playPause()
    }

    const settings = getEffectSettings(controls)

    return (
        <div className="now-playing-bar">
            <img
                className="now-playing-bar-image"
                src={playerBar}
                alt=""
            />

            <div className="now-playing-disc">
                <div className="now-playing-disc-plane">
                    <img
                        className="now-playing-disc-image"
                        src={discImage}
                        alt=""
                        ref={discRef}
                    />
                </div>

                <div className="now-playing-disc-glow" ref={glowRef} />
            </div>

            <button
                className="now-playing-button now-playing-prev"
                title="previous track"
                disabled={!canGoPrevious}
                onClick={onPrevious}
            >
                <PrevIcon />
            </button>

            <button
                className="now-playing-button now-playing-play"
                title={isPlaying ? "pause" : "play"}
                disabled={!track}
                onClick={handlePlayPause}
            >
                <PlayPauseIcon isPlaying={isPlaying} />
            </button>

            <button
                className="now-playing-button now-playing-next"
                title="next track"
                disabled={!canGoNext}
                onClick={onNext}
            >
                <NextIcon />
            </button>

            <div className="now-playing-screen">
                <div className="now-playing-info">
                    <div className="now-playing-name" ref={nameBoxRef}>
                        <span ref={nameTextRef}>
                            {track ? track.name : "insert a track ♡"}
                        </span>
                    </div>

                    <p className="now-playing-detail">
                        {settings.playbackRate.toFixed(2)}x · {settings.pitch >= 0 ? "+" : ""}{settings.pitch.toFixed(2)} st
                    </p>

                    <p className="now-playing-time" ref={timeRef}>
                        --:-- / --:--
                    </p>
                </div>

                <canvas
                    className="now-playing-spectrum"
                    ref={canvasRef}
                    width="160"
                    height="96"
                />
            </div>
        </div>
    )
}

export default NowPlayingBar
