import { useEffect, useRef } from "react"
import * as Tone from "tone"
import { getEffectSettings } from "./effectSettings"

export function useAudioEngine(
    wavesurferRef,
    controls,
    audioUrl
) {
    const sourceRef = useRef(null)
    const filterRef = useRef(null)
    const reverbRef = useRef(null)
    const bassBoostRef = useRef(null)
    const stereoWidenerRef = useRef(null)
    const pitchShiftRef = useRef(null)
    const analyserRef = useRef(null)
    const connectedWaveSurferRef = useRef(null)

    useEffect(() => {
        if (!wavesurferRef.current) return

        const wavesurfer = wavesurferRef.current

        if (connectedWaveSurferRef.current === wavesurfer) return

        const mediaElement =
            wavesurfer.getMediaElement?.()

        if (!mediaElement) return

        Tone.start()

        filterRef.current =
            new Tone.Filter({
                type: "lowpass",
                frequency: 20000,
                rolloff: -12,
            })

        bassBoostRef.current =
            new Tone.EQ3({
                low: 0,
                mid: 0,
                high: 0,
            })

        stereoWidenerRef.current =
            new Tone.StereoWidener({
                width: 0,
            })

        pitchShiftRef.current =
            new Tone.PitchShift({
                pitch: 0,
                windowSize: 0.08,
                delayTime: 0,
                feedback: 0,
            })

        reverbRef.current =
            new Tone.Reverb({
                decay: 5,
                wet: 0,
            }).toDestination()

        // taps the final output for the now playing visualizer and disc glow
        analyserRef.current =
            new Tone.Analyser("fft", 64)

        reverbRef.current.connect(
            analyserRef.current
        )

        const context =
            Tone.getContext().rawContext

        sourceRef.current =
            context.createMediaElementSource(mediaElement)

        Tone.connect(
            sourceRef.current,
            bassBoostRef.current
        )

        bassBoostRef.current.connect(
            stereoWidenerRef.current
        )

        stereoWidenerRef.current.connect(
            pitchShiftRef.current
        )

        pitchShiftRef.current.connect(
            filterRef.current
        )

        filterRef.current.connect(
            reverbRef.current
        )

        connectedWaveSurferRef.current = wavesurfer

        return () => {
            sourceRef.current?.disconnect()
            bassBoostRef.current?.dispose()
            filterRef.current?.dispose()
            reverbRef.current?.dispose()
            stereoWidenerRef.current?.dispose()
            pitchShiftRef.current?.dispose()
            analyserRef.current?.dispose()


            sourceRef.current = null
            bassBoostRef.current = null
            filterRef.current = null
            reverbRef.current = null
            stereoWidenerRef.current = null
            pitchShiftRef.current = null
            analyserRef.current = null
            connectedWaveSurferRef.current = null
        }
    }, [audioUrl, wavesurferRef])

    useEffect(() => {
        if (!wavesurferRef.current) return

        const settings =
            getEffectSettings(controls)

        wavesurferRef.current.setPlaybackRate(
            settings.playbackRate,
            false
        )

        if (filterRef.current) {
            filterRef.current.frequency.value =
                settings.lowpassFrequency
        }

        if (reverbRef.current) {
            reverbRef.current.wet.value =
                settings.reverbWet
        }

        if (bassBoostRef.current) {
            bassBoostRef.current.low.value =
                settings.eq.low

            bassBoostRef.current.mid.value =
                settings.eq.mid

            bassBoostRef.current.high.value =
                settings.eq.high
        }

        if (stereoWidenerRef.current) {
            stereoWidenerRef.current.width.value =
                settings.stereoWidth
        }

        if (pitchShiftRef.current) {
            pitchShiftRef.current.pitch =
                settings.pitch
        }

    }, [controls, wavesurferRef])

    return analyserRef
}