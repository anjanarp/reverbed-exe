import sliderBar from "../assets/slider-bar.png"
import sliderButton from "../assets/slider-button.png"

// one tick per 1% on the main slider, taller every 5% and 10%
const MAIN_TICKS = Array.from({ length: 61 }, (_, index) => index - 30)
const SMALL_TICKS = [0, 25, 50, 75, 100]

function AdvancedSlider({
    label,
    valueLabel,
    value,
    min,
    max,
    step,
    onChange
}) {
    const percent =
        ((value - min) / (max - min)) * 100

    return (
        <div className="advanced-slider">
            <div className="advanced-slider-header">
                <span>{label}</span>
                <span>{valueLabel}</span>
            </div>

            <div className="advanced-slider-track-wrapper">
                <img
                    src={sliderBar}
                    alt=""
                    className="advanced-slider-bar"
                />

                <div className="advanced-slider-ticks">
                    {SMALL_TICKS.map((tick) => (
                        <span key={tick} style={{ left: `${tick}%` }} />
                    ))}
                </div>

                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(event) =>
                        onChange(Number(event.target.value))
                    }
                    className="advanced-slider-input"
                />

                <img
                    src={sliderButton}
                    alt=""
                    className="advanced-slider-button"
                    style={{
                        left: `${percent}%`,
                    }}
                />
            </div>
        </div>
    )
}

function TransformPanel({
    transformAmount,
    setTransformAmount,
    speedAmount,
    setSpeedAmount,
    pitchAmount,
    setPitchAmount,
    reverbAmount,
    setReverbAmount,
    bassBoostAmount,
    setBassBoostAmount,
    eqProfile,
    setEqProfile,
    stereoWidthAmount,
    setStereoWidthAmount
}) {


    const sliderPercent = ((transformAmount + 30) / 60) * 100

    const profiles = [
        "Warm",
        "Clean",
        "Bright",
        "Dark"
    ]

    const currentProfileIndex =
        profiles.indexOf(eqProfile)

    function previousProfile() {
        const previousIndex =
            (currentProfileIndex - 1 + profiles.length) % profiles.length

        setEqProfile(profiles[previousIndex])
    }

    function nextProfile() {
        const nextIndex =
            (currentProfileIndex + 1) % profiles.length

        setEqProfile(profiles[nextIndex])
    }

    return (
        <section className="transform-panel-wrapper">
            <div className="transform-panel-container">
                <div className="transform-frame-image" />

                <div className="transform-slider-section">
                    <div className="transform-slider-labels">
                        <div>
                            <p className="transform-slider-percent">-30%</p>
                            <p className="transform-slider-mode">SLOWED + REVERB</p>
                        </div>

                        <div>
                            <p className="transform-slider-percent">0%</p>
                            <p className="transform-slider-mode">NORMAL</p>
                        </div>

                        <div>
                            <p className="transform-slider-percent">+30%</p>
                            <p className="transform-slider-mode">NIGHTCORE</p>
                        </div>
                    </div>

                    <div className="transform-slider-track-wrapper">
                        <div className="transform-slider-ticks">
                            {MAIN_TICKS.map((tick) => (
                                <span
                                    key={tick}
                                    className={tick % 10 === 0 ? "tick-major" : tick % 5 === 0 ? "tick-mid" : ""}
                                    style={{ left: `${((tick + 30) / 60) * 100}%` }}
                                />
                            ))}
                        </div>

                        <img
                            src={sliderBar}
                            alt="transform slider bar"
                            className="transform-slider-bar"
                        />

                        <input
                            type="range"
                            min="-30"
                            max="30"
                            step="1"
                            value={transformAmount}
                            onChange={(event) =>
                                setTransformAmount(Number(event.target.value))
                            }
                            className="transform-slider-input"
                        />

                        <img
                            src={sliderButton}
                            alt="transform slider button"
                            className="transform-slider-button"
                            style={{
                                left: `${sliderPercent}%`,
                            }}
                        />
                    </div>
                </div>
                <div className="advanced-transform-section">
                    <div className="advanced-content">
                        <div className="advanced-section-title">
                            <span className="advanced-section-line" />
                            ✦ ADVANCED ✦
                            <span className="advanced-section-line" />
                        </div>

                        <div className="advanced-grid advanced-row">
                            <AdvancedSlider
                                label="SPEED"
                                valueLabel={`${(1 + speedAmount / 100).toFixed(2)}x`}
                                value={speedAmount}
                                min={-30}
                                max={30}
                                step={1}
                                onChange={setSpeedAmount}
                            />

                            <AdvancedSlider
                                label="PITCH"
                                valueLabel={`${pitchAmount >= 0 ? "+" : ""}${pitchAmount.toFixed(2)} st`}
                                value={pitchAmount}
                                min={-4}
                                max={4}
                                step={0.5}
                                onChange={setPitchAmount}
                            />

                            <AdvancedSlider
                                label="REVERB"
                                valueLabel={`${reverbAmount}%`}
                                value={reverbAmount}
                                min={0}
                                max={100}
                                step={1}
                                onChange={setReverbAmount}
                            />
                        </div>

                        <div className="advanced-grid advanced-row">
                            <AdvancedSlider
                                label="BASS BOOST"
                                valueLabel={`${bassBoostAmount}%`}
                                value={bassBoostAmount}
                                min={0}
                                max={100}
                                step={1}
                                onChange={setBassBoostAmount}
                            />

                            <div className="advanced-eq-control">
                                <div className="advanced-slider-header">
                                    <span>EQ PROFILE</span>
                                </div>

                                <div className="eq-profile-selector">
                                    <button
                                        onClick={previousProfile}
                                    >
                                        ◀
                                    </button>

                                    <span>
                                        {eqProfile.toUpperCase()}
                                    </span>

                                    <button
                                        onClick={nextProfile}
                                    >
                                        ▶
                                    </button>
                                </div>
                            </div>

                            <AdvancedSlider
                                label="STEREO WIDTH"
                                valueLabel={`${stereoWidthAmount}%`}
                                value={stereoWidthAmount}
                                min={0}
                                max={200}
                                step={5}
                                onChange={setStereoWidthAmount}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section >
    )
}

export default TransformPanel