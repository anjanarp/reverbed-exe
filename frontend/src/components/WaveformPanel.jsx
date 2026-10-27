import { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js"
import { useAudioEngine } from "../audio/useAudioEngine"

function WaveformPanel({
    audioUrl,
    transformAmount,
    speedAmount,
    pitchAmount,
    reverbAmount,
    bassBoostAmount,
    eqProfile,
    stereoWidthAmount,
    onLoopChange,
    onDurationKnown,
    playerRef
}) {
    const waveformRef = useRef(null)
    const wavesurferRef = useRef(null)
    const regionsRef = useRef(null)
    const loopRegionRef = useRef(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState("00:00.00")
    const [duration, setDuration] = useState("00:00.00")

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        const centiseconds = Math.floor((seconds % 1) * 100)

        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`
    }

    useEffect(() => {
        if (!audioUrl) return

        const regions = RegionsPlugin.create()

        const wavesurfer = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#7510ec",
            progressColor: "#bd00ff",
            cursorColor: "#ffffff",
            cursorWidth: 2,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 120,
            url: audioUrl,
            plugins: [regions],
        })

        wavesurferRef.current = wavesurfer
        regionsRef.current = regions

        wavesurfer.on("ready", () => {
            regions.enableDragSelection({
                color: "rgba(199, 125, 255, 0.28)",
                drag: true,
                resize: true,
            })

            setDuration(formatTime(wavesurfer.getDuration()))
            onDurationKnown(wavesurfer.getDuration())

            // the now playing bar's skip buttons ask the next track to start right away
            if (playerRef.current.pendingPlay) {
                playerRef.current.pendingPlay = false
                wavesurfer.play()
            }
        })

        regions.on("region-created", (region) => {
            if (loopRegionRef.current && loopRegionRef.current.id !== region.id) {
                loopRegionRef.current.remove()
            }

            loopRegionRef.current = region
            onLoopChange({ start: region.start, end: region.end })

            region.element.classList.add("loop-region")

            const cornerPositions = [
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
            ]

            cornerPositions.forEach((position) => {
                const corner = document.createElement("div")

                corner.classList.add("loop-region-corner")
                corner.classList.add(position)

                region.element.appendChild(corner)
            })
        })

        regions.on("region-updated", (region) => {
            if (loopRegionRef.current && region.id === loopRegionRef.current.id) {
                onLoopChange({ start: region.start, end: region.end })
            }
        })

        regions.on("region-out", (region) => {
            if (loopRegionRef.current && region.id === loopRegionRef.current.id) {
                region.play()
            }
        })

        wavesurfer.on("interaction", () => {
            wavesurfer.play()
        })

        wavesurfer.on("play", () => {
            setIsPlaying(true)
        })

        wavesurfer.on("pause", () => {
            setIsPlaying(false)
        })

        wavesurfer.on("finish", () => {
            setIsPlaying(false)
        })

        wavesurfer.on("timeupdate", (current) => {
            setCurrentTime(formatTime(current))
        })

        return () => {
            wavesurfer.destroy()
            wavesurferRef.current = null
            regionsRef.current = null
            loopRegionRef.current = null
            onLoopChange(null)
        }
        // the callbacks from App don't change between renders
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioUrl])

    function handlePlayPause() {
        if (!wavesurferRef.current) return

        wavesurferRef.current.playPause()
    }

    function handleClearLoop() {
        if (!loopRegionRef.current) return

        loopRegionRef.current.remove()
        loopRegionRef.current = null
        onLoopChange(null)
    }

    const analyserRef = useAudioEngine(
        wavesurferRef,
        {
            transformAmount,
            speedAmount,
            pitchAmount,
            reverbAmount,
            bassBoostAmount,
            eqProfile,
            stereoWidthAmount
        },
        audioUrl
    )

    useEffect(() => {
        // lets the now playing bar read playback state without re-rendering the app every frame
        playerRef.current.getWaveSurfer = () => wavesurferRef.current
        playerRef.current.getAnalyser = () => analyserRef.current
    }, [playerRef, analyserRef])

    return (
        <section className="waveform-panel-wrapper">
            <div className="waveform-panel-container">
                <div className="waveform-frame-image" />

                <div className="waveform-timestamp">
                    {currentTime} / {duration}
                </div>

                <div
                    ref={waveformRef}
                    className="waveform-display"
                />

                {audioUrl && (
                    <div className="waveform-controls">
                        <button
                            className="waveform-play-button"
                            onClick={handlePlayPause}
                        >
                            {isPlaying ? "❚❚" : "▶"}
                        </button>

                        <button
                            className="waveform-clear-loop-button"
                            onClick={handleClearLoop}
                        >
                            CLEAR LOOP
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}

export default WaveformPanel