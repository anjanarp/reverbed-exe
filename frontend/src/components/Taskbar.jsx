import { useEffect, useRef, useState } from "react"

import planetIcon from "../assets/planet-icon.png"

function formatClock(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function formatDate(date) {
    return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" })
}

function SpeakerIcon({ muted }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path className="tray-fill" d="M3 9h4l5-4v14l-5-4H3z" />
            {muted ? (
                <path d="M16 9l5 6M21 9l-5 6" />
            ) : (
                <>
                    <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
                    <path d="M18 7a7 7 0 0 1 0 10" />
                </>
            )}
        </svg>
    )
}

function RainIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z" />
            <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
        </svg>
    )
}

function GrainIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle className="tray-fill" cx="8" cy="8" r="1.1" />
            <circle className="tray-fill" cx="14" cy="7" r="1.1" />
            <circle className="tray-fill" cx="11" cy="12" r="1.1" />
            <circle className="tray-fill" cx="17" cy="13" r="1.1" />
            <circle className="tray-fill" cx="7" cy="16" r="1.1" />
            <circle className="tray-fill" cx="14" cy="17" r="1.1" />
        </svg>
    )
}

function WifiIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 9a14 14 0 0 1 19 0" />
            <path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" />
            <path d="M8.5 16a5 5 0 0 1 7 0" />
            <circle className="tray-fill" cx="12" cy="19" r="1.4" />
        </svg>
    )
}

function BatteryIcon({ level }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="7" width="18" height="10" rx="1.5" />
            <path d="M22 10.5v3" />
            <rect className="tray-fill" x="4" y="9" width={14 * level} height="6" />
        </svg>
    )
}

function Taskbar({
    track,
    playerRef,
    muted,
    onToggleMute,
    ambienceEnabled,
    onToggleAmbience,
    onResetEffects,
    onClearHistory,
    grainOn,
    onToggleGrain
}) {
    const [now, setNow] = useState(() => new Date())
    const [menuOpen, setMenuOpen] = useState(false)
    const [batteryLevel, setBatteryLevel] = useState(1)
    const startRef = useRef(null)

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)

        return () => clearInterval(timer)
    }, [])

    // the battery icon shows the real level where the browser exposes it
    useEffect(() => {
        let battery

        function update() {
            setBatteryLevel(battery.level)
        }

        navigator.getBattery?.().then((result) => {
            battery = result
            update()
            battery.addEventListener("levelchange", update)
        })

        return () => battery?.removeEventListener("levelchange", update)
    }, [])

    useEffect(() => {
        if (!menuOpen) return

        function closeOnOutsideClick(event) {
            if (!startRef.current.contains(event.target)) {
                setMenuOpen(false)
            }
        }

        document.addEventListener("mousedown", closeOnOutsideClick)

        return () => document.removeEventListener("mousedown", closeOnOutsideClick)
    }, [menuOpen])

    function runMenuItem(action) {
        action()
        setMenuOpen(false)
    }

    return (
        <footer className="taskbar">
            <div className="taskbar-clock">
                <span className="taskbar-time">{formatClock(now)}</span>
                <span className="taskbar-date">{formatDate(now)}</span>
            </div>

            <div className="taskbar-start-wrapper" ref={startRef}>
                <button
                    className={`taskbar-start ${menuOpen ? "taskbar-start-open" : ""}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    ✦ start
                </button>

                {menuOpen && (
                    <div className="taskbar-menu">
                        <p className="taskbar-menu-title">reverbed.exe</p>

                        <button onClick={() => runMenuItem(onResetEffects)}>
                            ↺ reset effects
                        </button>

                        <button onClick={() => runMenuItem(onClearHistory)}>
                            ✕ clear history
                        </button>

                        <button onClick={() => runMenuItem(onToggleGrain)}>
                            ▒ film grain: {grainOn ? "on" : "off"}
                        </button>

                        <p className="taskbar-menu-note">
                            hear it differently. ♡
                        </p>
                    </div>
                )}
            </div>

            <div className="taskbar-tabs">
                <div className="taskbar-tab taskbar-tab-active">
                    <img className="taskbar-tab-icon taskbar-tab-planet" src={planetIcon} alt="" />
                    <span className="taskbar-tab-label">reverbed.exe</span>
                </div>

                <button
                    className="taskbar-tab"
                    title={track ? "play / pause" : undefined}
                    disabled={!track}
                    onClick={() => playerRef.current.getWaveSurfer?.()?.playPause()}
                >
                    <span className="taskbar-tab-icon">♪</span>
                    <span className="taskbar-tab-label">
                        {track ? track.name : "now playing"}
                    </span>
                </button>
            </div>

            <div className="taskbar-tray">
                <button
                    className={`taskbar-tray-button ${ambienceEnabled ? "taskbar-tray-on" : ""}`}
                    title={ambienceEnabled ? "ambience on" : "ambience off"}
                    onClick={onToggleAmbience}
                >
                    <RainIcon />
                </button>

                <button
                    className={`taskbar-tray-button ${muted ? "" : "taskbar-tray-on"}`}
                    title={muted ? "unmute" : "mute"}
                    onClick={onToggleMute}
                >
                    <SpeakerIcon muted={muted} />
                </button>

                <button
                    className={`taskbar-tray-button ${grainOn ? "taskbar-tray-on" : ""}`}
                    title={grainOn ? "film grain on" : "film grain off"}
                    onClick={onToggleGrain}
                >
                    <GrainIcon />
                </button>

                <span className="taskbar-tray-button taskbar-tray-static">
                    <WifiIcon />
                </span>

                <span className="taskbar-tray-button taskbar-tray-static">
                    <BatteryIcon level={batteryLevel} />
                </span>
            </div>
        </footer>
    )
}

export default Taskbar
