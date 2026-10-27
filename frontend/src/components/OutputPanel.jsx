import { useEffect, useState } from "react"

import { ambienceOptions } from "../audio/ambiences"
import { encodeMp3, encodeWav, renderExport } from "../audio/renderExport"
import { canSaveToFolder, chooseFolder, loadSavedFolder, saveToFolder } from "../audio/spotifyFolder"

const rangeOptions = ["Full Track", "Loop Only"]
const formatOptions = ["MP3 320", "WAV"]
const mixOptions = ["Off", "On"]

// remembers (in this browser only) that spotify was pointed at the folder
const SETUP_KEY = "reverbed-spotify-setup"

function readSetupDone() {
    try {
        return localStorage.getItem(SETUP_KEY) === "done"
    } catch {
        return false
    }
}

function writeSetupDone(done) {
    try {
        if (done) localStorage.setItem(SETUP_KEY, "done")
        else localStorage.removeItem(SETUP_KEY)
    } catch {
        // storage blocked; setup just shows again next visit
    }
}

function cycle(options, current, direction) {
    const index = options.indexOf(current)

    return options[(index + direction + options.length) % options.length]
}

function Selector({ options, value, onChange }) {
    return (
        <div className="ambience-type-selector output-selector">
            <button onClick={() => onChange(cycle(options, value, -1))}>◀</button>

            <span>{value}</span>

            <button onClick={() => onChange(cycle(options, value, 1))}>▶</button>
        </div>
    )
}

function OutputPanel({
    audioUrl,
    trackName,
    controls,
    loop,
    ambienceType,
    ambienceVolume
}) {
    const [range, setRange] = useState("Full Track")
    const [format, setFormat] = useState("MP3 320")
    const [mixAmbience, setMixAmbience] = useState("Off")
    const [status, setStatus] = useState("")
    const [isExporting, setIsExporting] = useState(false)

    // the back of the card: save straight into a folder Spotify watches
    const [flipped, setFlipped] = useState(false)
    const [setupDone, setSetupDone] = useState(readSetupDone)
    const [showInfo, setShowInfo] = useState(false)
    const [infoPage, setInfoPage] = useState("phone")
    const [folder, setFolder] = useState(null)
    const [spotifyStatus, setSpotifyStatus] = useState("")

    useEffect(() => {
        loadSavedFolder().then(setFolder)
    }, [])

    const loopOnly = range === "Loop Only"
    const missingLoop = loopOnly && !loop
    const canExport = audioUrl && !missingLoop && !isExporting

    function clearStatus(setter) {
        return (value) => {
            setStatus("")
            setSpotifyStatus("")
            setter(value)
        }
    }

    function exportName() {
        const baseName = (trackName || "track").replace(/[\\/:*?"<>|]/g, "")

        return `${baseName} (${loopOnly ? "reverbed loop" : "reverbed"})`
    }

    function downloadFile(file, name) {
        const link = document.createElement("a")
        link.href = URL.createObjectURL(file)
        link.download = name
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }

    async function renderTrack(asMp3, report) {
        report("RENDERING...")

        const ambience = mixAmbience === "On"
            ? {
                sound: ambienceOptions.find((option) => option.name === ambienceType).sound,
                volume: ambienceVolume / 100,
            }
            : null

        const rendered = await renderExport({
            audioUrl,
            controls,
            loop: loopOnly ? loop : null,
            ambience,
        })

        if (!asMp3) return encodeWav(rendered)

        report("ENCODING MP3...")

        // encoded right here in the browser, so exports cost the server nothing
        return encodeMp3(rendered)
    }

    async function handleChooseFolder() {
        try {
            const chosen = await chooseFolder()

            // a new folder means spotify has to be told about it again
            if (chosen.name !== folder?.name) {
                setSetupDone(false)
                writeSetupDone(false)
            }

            setFolder(chosen)
            setSpotifyStatus("")
        } catch {
            // picker closed without choosing
        }
    }

    function finishSetup() {
        setSetupDone(true)
        writeSetupDone(true)
    }

    async function handleSaveToSpotify() {
        setIsExporting(true)

        try {
            // spotify only plays mp3 local files
            const file = await renderTrack(true, setSpotifyStatus)

            if (folder) {
                setSpotifyStatus("SAVING...")
                await saveToFolder(folder, exportName(), file)
                setSpotifyStatus("IN LOCAL FILES ♡")
            } else {
                downloadFile(file, `${exportName()}.mp3`)
                setSpotifyStatus("DOWNLOADED ♡")
            }
        } catch (error) {
            console.error(error)
            setSpotifyStatus(error.message === "folder permission denied" ? "ALLOW THE FOLDER FIRST" : "SAVE FAILED")
        } finally {
            setIsExporting(false)
        }
    }

    async function handleExport() {
        setIsExporting(true)

        try {

            const asMp3 = format === "MP3 320"
            const file = await renderTrack(asMp3, setStatus)

            downloadFile(file, `${exportName()}.${asMp3 ? "mp3" : "wav"}`)

            setStatus("SAVED ♡")
        } catch (error) {
            console.error(error)
            setStatus("EXPORT FAILED")
        } finally {
            setIsExporting(false)
        }
    }

    // the button doubles as the status readout to keep the panel compact
    let buttonLabel = status || "EXPORT AUDIO"

    if (isExporting) {
        buttonLabel = status
    } else if (!audioUrl) {
        buttonLabel = "LOAD A TRACK FIRST"
    } else if (missingLoop) {
        buttonLabel = "SET A LOOP FIRST"
    }

    let spotifyLabel = spotifyStatus || (folder ? "SAVE TO SPOTIFY" : "DOWNLOAD FOR SPOTIFY")

    if (isExporting) {
        spotifyLabel = spotifyStatus
    } else if (!audioUrl) {
        spotifyLabel = "LOAD A TRACK FIRST"
    } else if (missingLoop) {
        spotifyLabel = "SET A LOOP FIRST"
    }

    const flipButton = (
        <button
            className="output-flip-button"
            title={flipped ? "back to output" : "save to spotify"}
            onClick={() => {
                setFlipped(!flipped)
                setShowInfo(false)
            }}
        >
            ↻
        </button>
    )

    return (
        <section className={`output-panel ${flipped ? "output-panel-flipped" : ""}`}>
            <div className="output-card">
                <div className="output-face output-face-front" inert={flipped ? true : undefined}>
                    {flipButton}

                    <div className="output-content">
                        {/* two columns so every selector lines up */}
                        <div className="output-grid">
                            <span className="output-label">RANGE</span>
                            <span className="output-label">FORMAT</span>

                            <Selector options={rangeOptions} value={range} onChange={clearStatus(setRange)} />
                            <Selector options={formatOptions} value={format} onChange={clearStatus(setFormat)} />

                            <span className="output-label output-label-inline">MIX AMBIENCE</span>
                            <Selector options={mixOptions} value={mixAmbience} onChange={clearStatus(setMixAmbience)} />
                        </div>

                        <button
                            className="upload-button output-export-button"
                            title={missingLoop ? "drag on the waveform to set a loop" : undefined}
                            disabled={!canExport}
                            onClick={handleExport}
                        >
                            ✦   {buttonLabel}   ☆
                        </button>
                    </div>
                </div>

                <div className="output-face output-face-back" inert={flipped ? undefined : true}>
                    {flipButton}

                    <button
                        className={`output-help-button output-info-button ${showInfo ? "output-help-open" : ""}`}
                        title="phone setup + limits"
                        onClick={() => setShowInfo(!showInfo)}
                    >
                        ⓘ
                    </button>

                    {setupDone && !showInfo && (
                        <button
                            className="output-help-button"
                            title="setup steps"
                            onClick={() => {
                                setSetupDone(false)
                                writeSetupDone(false)
                            }}
                        >
                            ?
                        </button>
                    )}

                    <div className="output-content">
                        {showInfo && (
                            <div className="spotify-info-view">
                                <div className="spotify-info-tabs">
                                    <button
                                        className={infoPage === "phone" ? "spotify-info-tab-active" : ""}
                                        onClick={() => setInfoPage("phone")}
                                    >
                                        ON YOUR PHONE
                                    </button>

                                    <button
                                        className={infoPage === "limits" ? "spotify-info-tab-active" : ""}
                                        onClick={() => setInfoPage("limits")}
                                    >
                                        GOOD TO KNOW
                                    </button>
                                </div>

                                {infoPage === "phone" ? (
                                    <ol className="spotify-steps spotify-info">
                                        <li>laptop: songs in a <b>playlist</b>, spotify open</li>
                                        <li>phone on the <b>same wi-fi</b></li>
                                        <li>phone: <b>settings → apps and devices → local audio files</b> on (tap allow)</li>
                                        <li>open the playlist on your phone, tap <b>↓ download</b> ♡</li>
                                        <li className="spotify-note">needs spotify premium</li>
                                    </ol>
                                ) : (
                                    <ul className="spotify-steps spotify-info">
                                        <li>songs show up in spotify's <b>Local Files</b>. drag them into a playlist</li>
                                        <li>only <b>you</b> can play them, not friends</li>
                                        <li>no <b>speakers, tvs</b> or <b>spotify in a browser</b></li>
                                        <li>on <b>safari</b> or <b>firefox</b>, songs go to your downloads. move them into your folder</li>
                                    </ul>
                                )}
                            </div>
                        )}

                        {!showInfo && !setupDone && canSaveToFolder && !folder && (
                            <div className="spotify-step">
                                <p className="spotify-step-count">STEP 1 OF 2</p>
                                <p className="spotify-step-text">
                                    pick a folder for your reverbed songs. a new one works best, like <b>Music/reverbed</b>
                                </p>

                                <button className="upload-button output-export-button" onClick={handleChooseFolder}>
                                    ✦   CHOOSE A FOLDER   ☆
                                </button>
                            </div>
                        )}

                        {!showInfo && !setupDone && canSaveToFolder && folder && (
                            <div className="spotify-step">
                                <p className="spotify-step-count">
                                    STEP 2 OF 2 · <button className="spotify-link" onClick={handleChooseFolder}>change folder</button>
                                </p>
                                <p className="spotify-step-text">
                                    in spotify: <b>settings</b> → turn on <b>show local files</b> → <b>add a source</b> → pick <b>▤ {folder.name}</b>
                                </p>

                                <button className="upload-button output-export-button" onClick={finishSetup}>
                                    ✦   I DID IT   ☆
                                </button>
                            </div>
                        )}

                        {!showInfo && !setupDone && !canSaveToFolder && (
                            <div className="spotify-step">
                                <p className="spotify-step-count">HEADS UP</p>
                                <p className="spotify-step-text">
                                    this browser can't save into folders, so songs <b>download</b> instead. drop them in a folder spotify watches (<b>settings</b> → <b>add a source</b>), or use chrome to skip that
                                </p>

                                <button className="upload-button output-export-button" onClick={finishSetup}>
                                    ✦   GOT IT   ☆
                                </button>
                            </div>
                        )}

                        {!showInfo && setupDone && (
                            <>
                                <div className="output-grid">
                                    <span className="output-label">FOLDER</span>
                                    <span className="output-label">RANGE</span>

                                    <button
                                        className="ambience-type-selector output-selector output-folder-button"
                                        title={canSaveToFolder ? "change folder" : "this browser downloads instead"}
                                        disabled={!canSaveToFolder}
                                        onClick={handleChooseFolder}
                                    >
                                        <span>
                                            {!canSaveToFolder ? "DOWNLOADS" : folder ? `▤ ${folder.name}` : "CHOOSE..."}
                                        </span>
                                    </button>

                                    <Selector options={rangeOptions} value={range} onChange={clearStatus(setRange)} />

                                    <span className="output-label output-label-inline">MIX AMBIENCE</span>
                                    <Selector options={mixOptions} value={mixAmbience} onChange={clearStatus(setMixAmbience)} />
                                </div>

                                <button
                                    className="upload-button output-export-button"
                                    title={missingLoop ? "drag on the waveform to set a loop" : undefined}
                                    disabled={!canExport}
                                    onClick={handleSaveToSpotify}
                                >
                                    ✦   {spotifyLabel}   ☆
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default OutputPanel
