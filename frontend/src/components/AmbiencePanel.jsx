import { useEffect, useRef } from "react"

import ambienceFrame from "../assets/ambience-frame11.png"
import sliderBar from "../assets/slider-bar.png"
import sliderButton from "../assets/slider-button.png"
import { ambienceOptions } from "../audio/ambiences"

export default function AmbiencePanel({
    ambienceEnabled,
    setAmbienceEnabled,
    ambienceType,
    setAmbienceType,
    ambienceVolume,
    setAmbienceVolume,
    muted
}) {
    const audioRef = useRef(null)
    const fadeFrameRef = useRef(null)

    const selectedAmbience = ambienceOptions.find(
        (ambience) => ambience.name === ambienceType
    )
    const currentAmbienceIndex = ambienceOptions.findIndex(
        (ambience) => ambience.name === ambienceType
    )

    function fadeTo(audio, targetVolume, onDone) {
        cancelAnimationFrame(fadeFrameRef.current)

        const startVolume = audio.volume
        const startTime = performance.now()
        const fadeMs = 600

        function step(now) {
            const progress = Math.min(1, (now - startTime) / fadeMs)

            audio.volume = startVolume + (targetVolume - startVolume) * progress

            if (progress < 1) {
                fadeFrameRef.current = requestAnimationFrame(step)
            } else {
                onDone?.()
            }
        }

        fadeFrameRef.current = requestAnimationFrame(step)
    }

    // start, stop, or swap the looping ambience track
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio()
            audioRef.current.loop = true
            audioRef.current.volume = 0
            audioRef.current.muted = muted
        }

        const audio = audioRef.current
        const targetVolume = ambienceVolume / 100

        if (!ambienceEnabled) {
            fadeTo(audio, 0, () => audio.pause())
            return
        }

        if (!audio.src.endsWith(selectedAmbience.sound)) {
            audio.src = selectedAmbience.sound
            audio.volume = 0
        }

        audio.play().catch(() => { })
        fadeTo(audio, targetVolume)
        // volume changes are handled separately so dragging the slider doesn't re-fade
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ambienceEnabled, ambienceType])

    useEffect(() => {
        if (!audioRef.current || !ambienceEnabled) return

        cancelAnimationFrame(fadeFrameRef.current)
        audioRef.current.volume = ambienceVolume / 100
    }, [ambienceVolume, ambienceEnabled])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = muted
        }
    }, [muted])

    useEffect(() => {
        return () => {
            cancelAnimationFrame(fadeFrameRef.current)
            audioRef.current?.pause()
        }
    }, [])

    function goToPreviousAmbience() {
        const previousIndex =
            (currentAmbienceIndex - 1 + ambienceOptions.length) %
            ambienceOptions.length

        setAmbienceType(ambienceOptions[previousIndex].name)
    }

    function goToNextAmbience() {
        const nextIndex =
            (currentAmbienceIndex + 1) % ambienceOptions.length

        setAmbienceType(ambienceOptions[nextIndex].name)
    }

    return (
        <div className="ambience-panel">
            <img
                className="ambience-frame"
                src={ambienceFrame}
                alt="Ambience panel frame"
            />

            <div className="ambience-content">
                <button
                    className={`ambience-power ${ambienceEnabled ? "ambience-power-on" : ""
                        }`}
                    onClick={() => setAmbienceEnabled(!ambienceEnabled)}
                >
                    ⏻
                </button>

                <img
                    className="ambience-preview"
                    src={selectedAmbience.image}
                    alt={selectedAmbience.name}
                />

                <div className="ambience-controls-row">
                    <div className="ambience-type-selector">
                        <button onClick={goToPreviousAmbience}>◀</button>

                        <span>{ambienceType}</span>

                        <button onClick={goToNextAmbience}>▶</button>
                    </div>

                    <span className="ambience-volume-percent">
                        {ambienceVolume}%
                    </span>
                </div>

                <div className="ambience-slider-row">
                    <span className="ambience-volume-label">VOLUME</span>

                    <div className="ambience-slider-track-wrapper">
                        <img
                            className="ambience-slider-bar"
                            src={sliderBar}
                            alt=""
                        />

                        <img
                            className="ambience-slider-button"
                            src={sliderButton}
                            alt=""
                            style={{
                                left: `${ambienceVolume}%`,
                            }}
                        />

                        <input
                            className="ambience-volume-slider"
                            type="range"
                            min="0"
                            max="100"
                            value={ambienceVolume}
                            onChange={(event) =>
                                setAmbienceVolume(Number(event.target.value))
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}