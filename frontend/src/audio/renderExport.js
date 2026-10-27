import * as Tone from "tone"
import { Mp3Encoder } from "@breezystack/lamejs"
import { getEffectSettings } from "./effectSettings"

// extra seconds rendered after a full track so the reverb can ring out
const REVERB_TAIL_SECONDS = 3

// renders the track through the same effect chain as live playback
export async function renderExport({ audioUrl, controls, loop, ambience }) {
    const settings = getEffectSettings(controls)

    const sourceBuffer = await new Tone.ToneAudioBuffer().load(audioUrl)
    const ambienceBuffer = ambience
        ? await new Tone.ToneAudioBuffer().load(ambience.sound)
        : null

    const offset = loop ? loop.start : 0
    const sourceSeconds = loop
        ? loop.end - loop.start
        : sourceBuffer.duration

    // a looped section stays tight so it repeats cleanly; a full track keeps its tail
    const playSeconds = sourceSeconds / settings.playbackRate
    const renderSeconds = loop
        ? playSeconds
        : playSeconds + REVERB_TAIL_SECONDS

    const rendered = await Tone.Offline(async () => {
        const reverb = new Tone.Reverb({ decay: 5, wet: settings.reverbWet }).toDestination()
        const filter = new Tone.Filter({ type: "lowpass", frequency: settings.lowpassFrequency, rolloff: -12 }).connect(reverb)
        const pitchShift = new Tone.PitchShift({ pitch: settings.pitch, windowSize: 0.08, delayTime: 0, feedback: 0 }).connect(filter)
        const widener = new Tone.StereoWidener({ width: settings.stereoWidth }).connect(pitchShift)
        const eq = new Tone.EQ3(settings.eq).connect(widener)

        await reverb.ready

        const player = new Tone.Player(sourceBuffer).connect(eq)
        player.playbackRate = settings.playbackRate
        // Tone scales this duration by playbackRate itself, so pass source seconds
        player.start(0, offset, sourceSeconds)

        if (ambienceBuffer) {
            // mixed in after the effects, matching how it sounds in the app
            const ambiencePlayer = new Tone.Player(ambienceBuffer).toDestination()
            ambiencePlayer.loop = true
            ambiencePlayer.volume.value = Tone.gainToDb(ambience.volume)
            ambiencePlayer.start(0)
        }
    }, renderSeconds)

    return rendered.get()
}

export function encodeWav(audioBuffer) {
    const channels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const frames = audioBuffer.length
    const bytesPerSample = 2
    const dataSize = frames * channels * bytesPerSample

    const view = new DataView(new ArrayBuffer(44 + dataSize))

    function writeString(position, text) {
        for (let i = 0; i < text.length; i++) {
            view.setUint8(position + i, text.charCodeAt(i))
        }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * channels * bytesPerSample, true)
    view.setUint16(32, channels * bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, dataSize, true)

    const channelData = Array.from(
        { length: channels },
        (_, channel) => audioBuffer.getChannelData(channel)
    )

    let position = 44

    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][frame]))
            view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
            position += bytesPerSample
        }
    }

    return new Blob([view], { type: "audio/wav" })
}

function toInt16(samples) {
    const output = new Int16Array(samples.length)

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]))
        output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }

    return output
}

export async function encodeMp3(audioBuffer, kbps = 320) {
    const channels = Math.min(2, audioBuffer.numberOfChannels)
    const encoder = new Mp3Encoder(channels, audioBuffer.sampleRate, kbps)

    const left = toInt16(audioBuffer.getChannelData(0))
    const right = channels > 1 ? toInt16(audioBuffer.getChannelData(1)) : null

    const blockSize = 1152
    const chunks = []

    for (let start = 0; start < left.length; start += blockSize) {
        const end = start + blockSize
        const encoded = right
            ? encoder.encodeBuffer(left.subarray(start, end), right.subarray(start, end))
            : encoder.encodeBuffer(left.subarray(start, end))

        if (encoded.length) chunks.push(new Uint8Array(encoded))

        // hand control back now and then so the page doesn't freeze on long tracks
        if (start % (blockSize * 400) === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0))
        }
    }

    const tail = encoder.flush()

    if (tail.length) chunks.push(new Uint8Array(tail))

    return new Blob(chunks, { type: "audio/mpeg" })
}
