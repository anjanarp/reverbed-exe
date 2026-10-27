import "./App.css"
import logo from "./assets/reverbed-logo.png"
import SourcePanel from "./components/SourcePanel"
import windowControls from "./assets/window-controls.png"
import WaveformPanel from "./components/WaveformPanel"
import TransformPanel from "./components/TransformPanel"
import AmbiencePanel from "./components/AmbiencePanel"
import HistoryPanel from "./components/HistoryPanel"
import OutputPanel from "./components/OutputPanel"
import NowPlayingBar from "./components/NowPlayingBar"
import PresetsPanel from "./components/PresetsPanel"
import Taskbar from "./components/Taskbar"
import AccessGate from "./components/AccessGate"
import { apiUrl, cleanupTracks, getAccessCode, verifyAccessCode } from "./api"
import * as Tone from "tone"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

const HISTORY_LIMIT = 50

// starting points; like history, presets only live for this session
const STARTER_PRESETS = [
  {
    id: "starter-slowed",
    name: "slowed + reverb",
    settings: { transformAmount: -30, speedAmount: 0, pitchAmount: 0, reverbAmount: 60, bassBoostAmount: 50, eqProfile: "Warm", stereoWidthAmount: 140 },
  },
  {
    id: "starter-nightcore",
    name: "nightcore",
    settings: { transformAmount: 30, speedAmount: 0, pitchAmount: 0, reverbAmount: 15, bassBoostAmount: 30, eqProfile: "Bright", stereoWidthAmount: 110 },
  },
  {
    id: "starter-underwater",
    name: "underwater",
    settings: { transformAmount: -15, speedAmount: 0, pitchAmount: -1, reverbAmount: 80, bassBoostAmount: 60, eqProfile: "Dark", stereoWidthAmount: 160 },
  },
]

function describeSettings(settings) {
  if (settings.transformAmount < 0) return "slowed"
  if (settings.transformAmount > 0) return "nightcore"

  return "custom"
}

function App() {
  const [audioUrl, setAudioUrl] = useState("")
  // read by the waveform's ready callback, which outlives the render it was created in
  const audioUrlRef = useRef("")

  useEffect(() => {
    audioUrlRef.current = audioUrl
  }, [audioUrl])
  const [history, setHistory] = useState([])
  // a code saved earlier in this tab counts; the server still checks it on every request
  const [unlocked, setUnlocked] = useState(() => Boolean(getAccessCode()))

  // a refresh or closed tab starts fresh, so delete this tab's files from the server
  const historyRef = useRef(history)

  useEffect(() => {
    historyRef.current = history
  }, [history])

  // a code remembered from earlier in this tab is re-checked, in case it was changed on the server
  useEffect(() => {
    const savedCode = getAccessCode()

    if (!savedCode) return

    verifyAccessCode(savedCode)
      .then((result) => setUnlocked(result.ok))
      .catch(() => { })
  }, [])

  useEffect(() => {
    function handlePageHide() {
      cleanupTracks(historyRef.current.map((track) => track.id))
    }

    window.addEventListener("pagehide", handlePageHide)

    return () => window.removeEventListener("pagehide", handlePageHide)
  }, [])
  const [activeTrackId, setActiveTrackId] = useState(null)
  const [transformAmount, setTransformAmount] = useState(0)

  const [speedAmount, setSpeedAmount] = useState(0)
  const [pitchAmount, setPitchAmount] = useState(0)
  const [reverbAmount, setReverbAmount] = useState(35)
  const [bassBoostAmount, setBassBoostAmount] = useState(40)
  const [eqProfile, setEqProfile] = useState("Warm")
  const [stereoWidthAmount, setStereoWidthAmount] = useState(120)

  const [loop, setLoop] = useState(null)

  const [ambienceEnabled, setAmbienceEnabled] = useState(false)
  const [ambienceType, setAmbienceType] = useState("Light Rain")
  const [ambienceVolume, setAmbienceVolume] = useState(30)

  const [muted, setMuted] = useState(false)
  const [grainOn, setGrainOn] = useState(true)

  useEffect(() => {
    Tone.getDestination().mute = muted
  }, [muted])

  const controls = useMemo(() => ({
    transformAmount,
    speedAmount,
    pitchAmount,
    reverbAmount,
    bassBoostAmount,
    eqProfile,
    stereoWidthAmount,
  }), [transformAmount, speedAmount, pitchAmount, reverbAmount, bassBoostAmount, eqProfile, stereoWidthAmount])

  const [presets, setPresets] = useState(STARTER_PRESETS)

  // a preset counts as active while the controls still match it exactly
  const activePresetId = presets.find((preset) =>
    Object.entries(preset.settings).every(([key, value]) => controls[key] === value)
  )?.id

  function handleSavePreset() {
    const settings = { ...controls }
    const baseName = describeSettings(settings)
    const count = presets.filter((preset) => preset.name.startsWith(baseName)).length

    setPresets((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: count ? `${baseName} ${count + 1}` : baseName,
        settings,
      },
    ])
  }

  function handleApplyPreset(preset) {
    const { settings } = preset

    setTransformAmount(settings.transformAmount)
    setSpeedAmount(settings.speedAmount)
    setPitchAmount(settings.pitchAmount)
    setReverbAmount(settings.reverbAmount)
    setBassBoostAmount(settings.bassBoostAmount)
    setEqProfile(settings.eqProfile)
    setStereoWidthAmount(settings.stereoWidthAmount)
  }

  function handleRenamePreset(id, name) {
    setPresets((previous) =>
      previous.map((preset) => (preset.id === id ? { ...preset, name } : preset))
    )
  }

  function handleResetEffects() {
    handleApplyPreset({
      settings: { transformAmount: 0, speedAmount: 0, pitchAmount: 0, reverbAmount: 35, bassBoostAmount: 40, eqProfile: "Warm", stereoWidthAmount: 120 },
    })
  }

  function handleClearHistory() {
    cleanupTracks(history.map((track) => track.id))
    setHistory([])
    setActiveTrackId(null)
    setAudioUrl("")
  }

  function handleRemovePreset(id) {
    setPresets((previous) => previous.filter((preset) => preset.id !== id))
  }

  const activeTrack = history.find((track) => track.id === activeTrackId)
  const activeIndex = history.findIndex((track) => track.id === activeTrackId)

  // filled in by WaveformPanel so the now playing bar can reach the player
  const playerRef = useRef({})

  // scale the panels to fill the space between the now playing bar and the taskbar,
  // leaving the same margin on every side as the gap between panels
  const shellRef = useRef(null)

  useLayoutEffect(() => {
    const shell = shellRef.current
    const PANEL_GAP = 14
    let scale = 1

    function fitShell() {
      shell.style.setProperty("--center-extra", "0px")

      // offsetWidth/Height ignore transforms, so these are the unscaled sizes
      const width = shell.offsetWidth
      const height = shell.offsetHeight

      // frame PNGs carry transparent margins; find where the visible frames start and end
      const box = shell.getBoundingClientRect()
      const rect = (selector) => shell.querySelector(selector).getBoundingClientRect()
      const insetTop = (rect(".source-panel-image").top - box.top) / scale + 16
      const insetLeft = (rect(".source-panel-image").left - box.left) / scale + 21
      const insetRight = (box.right - rect(".ambience-frame").right) / scale + 32
      const insetBottom = (box.bottom - rect(".transform-frame-image").bottom) / scale + 41

      const visibleWidth = width - insetLeft - insetRight
      const visibleHeight = height - insetTop - insetBottom

      const regionTop = document.querySelector(".now-playing-bar-image").getBoundingClientRect().bottom
      const regionBottom = document.querySelector(".taskbar").getBoundingClientRect().top
      const regionHeight = regionBottom - regionTop
      const regionWidth = window.innerWidth

      // fit the height, then let the center column widen into whatever width is left
      scale = regionHeight / (visibleHeight + PANEL_GAP * 2)
      let extra = regionWidth / scale - PANEL_GAP * 2 - visibleWidth

      if (extra < 0) {
        scale = regionWidth / (visibleWidth + PANEL_GAP * 2)
        extra = 0
      }

      shell.style.setProperty("--center-extra", `${extra}px`)

      const x = (regionWidth - (visibleWidth + extra) * scale) / 2 - insetLeft * scale
      const y = regionTop + (regionHeight - visibleHeight * scale) / 2 - insetTop * scale

      shell.style.transform = `translate(${x}px, ${y}px) scale(${scale})`

      // line the logo up with the source panel's visible edge (the logo art has ~5px of its own margin)
      document.documentElement.style.setProperty("--shell-left", `${x + insetLeft * scale - 5}px`)
    }

    fitShell()

    // images loading (panels or the now playing bar above them) or the window resizing all change what fits;
    // fitting resizes the shell itself, so run it on the next frame instead of inside the observer callback
    let frame = 0

    function scheduleFit() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fitShell)
    }

    const observer = new ResizeObserver(scheduleFit)
    observer.observe(shell)
    observer.observe(document.querySelector(".now-playing-bar"))
    window.addEventListener("resize", scheduleFit)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", scheduleFit)
    }
  }, [])

  function playTrackAt(index) {
    const track = history[index]

    if (!track) return

    playerRef.current.pendingPlay = true
    setActiveTrackId(track.id)
    setAudioUrl(track.audioUrl)
  }

  function handleTrackLoaded(data, source) {
    const track = {
      id: data.track_id,
      name: data.title || "untitled",
      audioUrl: apiUrl(data.audio_url),
      source,
      addedAt: Date.now(),
    }

    // the oldest track falls off the list, so its file on the server can go too
    cleanupTracks(history.slice(HISTORY_LIMIT - 1).map((old) => old.id))
    setHistory((previous) => [track, ...previous].slice(0, HISTORY_LIMIT))
    setActiveTrackId(track.id)
    setAudioUrl(track.audioUrl)
  }

  function handleSelectTrack(track) {
    setActiveTrackId(track.id)
    setAudioUrl(track.audioUrl)
  }

  function handleRenameTrack(id, name) {
    setHistory((previous) =>
      previous.map((track) => (track.id === id ? { ...track, name } : track))
    )
  }

  function handleTrackDuration(duration) {
    setHistory((previous) =>
      previous.map((track) => (track.audioUrl === audioUrlRef.current ? { ...track, duration } : track))
    )
  }

  function handleRemoveTrack(id) {
    // the playing track's file stays until the tab closes, so playback doesn't cut out
    if (id !== activeTrackId) {
      cleanupTracks([id])
    }

    setHistory((previous) => previous.filter((track) => track.id !== id))
  }

  return (
    <div className={`app ${grainOn ? "grain-on" : ""}`}>
      <img
        src={windowControls}
        alt="window controls"
        className="window-controls"
      />

      <AccessGate unlocked={unlocked} onUnlock={() => setUnlocked(true)} />
      <div className="title-bar">
        <img src={logo} alt="reverbed.exe logo" className="logo" />

        <div className="now-playing-slot">
          <NowPlayingBar
            playerRef={playerRef}
            track={activeTrack}
            controls={controls}
            canGoPrevious={activeIndex > 0}
            canGoNext={activeIndex >= 0 && activeIndex < history.length - 1}
            onPrevious={() => playTrackAt(activeIndex - 1)}
            onNext={() => playTrackAt(activeIndex + 1)}
          />
        </div>
      </div>

      <main className="stage">
        <div className={`player-shell ${unlocked ? "" : "player-shell-locked"}`} ref={shellRef}>
          <div className="left-stack">
            <SourcePanel
              onTrackLoaded={handleTrackLoaded}
            />

            <HistoryPanel
              history={history}
              activeTrackId={activeTrackId}
              onSelect={handleSelectTrack}
              onRename={handleRenameTrack}
              onRemove={handleRemoveTrack}
            />
          </div>
          <div className="workspace-row">
            <div className="center-stack">
              <WaveformPanel
                audioUrl={audioUrl}
                transformAmount={transformAmount}
                speedAmount={speedAmount}
                pitchAmount={pitchAmount}
                reverbAmount={reverbAmount}
                bassBoostAmount={bassBoostAmount}
                eqProfile={eqProfile}
                stereoWidthAmount={stereoWidthAmount}
                onLoopChange={setLoop}
                onDurationKnown={handleTrackDuration}
                playerRef={playerRef}
              />

              <TransformPanel
                transformAmount={transformAmount}
                setTransformAmount={setTransformAmount}
                speedAmount={speedAmount}
                setSpeedAmount={setSpeedAmount}
                pitchAmount={pitchAmount}
                setPitchAmount={setPitchAmount}
                reverbAmount={reverbAmount}
                setReverbAmount={setReverbAmount}
                bassBoostAmount={bassBoostAmount}
                setBassBoostAmount={setBassBoostAmount}
                eqProfile={eqProfile}
                setEqProfile={setEqProfile}
                stereoWidthAmount={stereoWidthAmount}
                setStereoWidthAmount={setStereoWidthAmount}
              />
            </div>

            <div className="right-stack">
              <AmbiencePanel
                ambienceEnabled={ambienceEnabled}
                setAmbienceEnabled={setAmbienceEnabled}
                ambienceType={ambienceType}
                setAmbienceType={setAmbienceType}
                ambienceVolume={ambienceVolume}
                setAmbienceVolume={setAmbienceVolume}
                muted={muted}
              />

              <OutputPanel
                audioUrl={audioUrl}
                trackName={activeTrack?.name}
                  controls={controls}
                loop={loop}
                ambienceType={ambienceType}
                ambienceVolume={ambienceVolume}
              />

              <PresetsPanel
                presets={presets}
                activePresetId={activePresetId}
                onSave={handleSavePreset}
                onApply={handleApplyPreset}
                onRename={handleRenamePreset}
                onRemove={handleRemovePreset}
              />
            </div>
          </div>
        </div>
      </main>

      <Taskbar
        track={activeTrack}
        playerRef={playerRef}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        ambienceEnabled={ambienceEnabled}
        onToggleAmbience={() => setAmbienceEnabled(!ambienceEnabled)}
        onResetEffects={handleResetEffects}
        onClearHistory={handleClearHistory}
        grainOn={grainOn}
        onToggleGrain={() => setGrainOn(!grainOn)}
      />
    </div >
  )
}

export default App