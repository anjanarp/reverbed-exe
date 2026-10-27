const eqProfiles = {
    Warm: {
        low: 2,
        mid: 0,
        high: -2,
    },
    Clean: {
        low: 0,
        mid: 0,
        high: 0,
    },
    Bright: {
        low: -1,
        mid: 0,
        high: 3,
    },
    Dark: {
        low: 1,
        mid: -1,
        high: -5,
    },
}

// shared by live playback and export so the downloaded file sounds like the preview
export function getEffectSettings({
    transformAmount,
    speedAmount,
    pitchAmount,
    reverbAmount,
    bassBoostAmount,
    eqProfile,
    stereoWidthAmount
}) {
    const normalizedAmount =
        transformAmount / 30

    const speedOffset =
        speedAmount / 100

    const playbackRate =
        1 + normalizedAmount * 0.25 + speedOffset

    const lowpassFrequency =
        normalizedAmount < 0
            ? 9000 + ((normalizedAmount + 1) * 11000)
            : 20000

    const macroReverb =
        normalizedAmount < 0
            ? Math.abs(normalizedAmount) * 0.45
            : 0

    const reverbWet =
        Math.min(
            0.85,
            macroReverb + (reverbAmount / 100) * 0.7
        )

    const bassGain =
        (bassBoostAmount / 100) * 10

    const selectedProfile =
        eqProfiles[eqProfile] || eqProfiles.Clean

    return {
        playbackRate,
        lowpassFrequency,
        reverbWet,
        eq: {
            low: selectedProfile.low + bassGain,
            mid: selectedProfile.mid,
            high: selectedProfile.high,
        },
        stereoWidth: stereoWidthAmount / 200,
        pitch: Math.max(-4, Math.min(4, pitchAmount)),
    }
}
