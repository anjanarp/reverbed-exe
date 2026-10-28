import sourceWindow from "../assets/source-window.png"
import planetIcon from "../assets/planet-icon.png"

import { useState } from "react"

import { apiFetch } from "../api"
import { helperAvailable, importViaHelper } from "../helper"

const MAX_UPLOAD_MB = 50

function isSoundCloud(url) {
    try {
        return new URL(url.trim()).hostname.toLowerCase().endsWith("soundcloud.com")
    } catch {
        return false
    }
}

function SourcePanel({ onTrackLoaded, onNeedHelper }) {

    const [youtubeUrl, setYoutubeUrl] = useState("")
    const [status, setStatus] = useState("")
    return (
        <section className="source-panel-image-wrapper">

            <div className="source-window-container">

                <img
                    src={sourceWindow}
                    alt="source window"
                    className="source-panel-image"
                />

                <div className="youtube-section">

                    <p className="youtube-label">
                        YouTube / SoundCloud URL
                    </p>

                    <input
                        className="youtube-input"
                        placeholder="paste a link..."
                        value={youtubeUrl}
                        onChange={(event) => setYoutubeUrl(event.target.value)}
                    />

                    <button
                        className="import-button"
                        onClick={async () => {
                            setStatus("importing...")

                            try {
                                const soundcloud = isSoundCloud(youtubeUrl)

                                // youtube blocks the cloud server, so prefer the visitor's own computer;
                                // soundcloud doesn't, so it always goes straight to the server
                                if (!soundcloud && await helperAvailable()) {
                                    setStatus("importing via your computer...")
                                    onTrackLoaded(await importViaHelper(youtubeUrl), "youtube")
                                    setStatus("downloaded ♡")
                                    return
                                }

                                // the local dev server can still reach youtube directly
                                if (!soundcloud && import.meta.env.PROD) {
                                    setStatus("youtube needs the helper ♡")
                                    onNeedHelper()
                                    return
                                }

                                const data = await apiFetch("/download", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        url: youtubeUrl,
                                    }),
                                })

                                onTrackLoaded(data, soundcloud ? "soundcloud" : "youtube")

                                setStatus("downloaded ♡")
                            } catch (error) {
                                setStatus(error.message)
                            }
                        }}
                    >
                        ✦   IMPORT   ☆
                    </button>

                    <img
                        src={planetIcon}
                        alt="planet icon"
                        className="planet-icon"
                    />

                    <p className="import-status">
                        {status}
                    </p>

                    <div className="upload-section">

                        <div className="divider-row">
                            <div className="divider-line"></div>

                            <p className="divider-text">
                                or
                            </p>

                            <div className="divider-line"></div>
                        </div>

                        <label
                            htmlFor="file-upload"
                            className="upload-button"
                        >
                            ✦      UPLOAD LOCAL FILE      ☆
                        </label>

                        <input
                            id="file-upload"
                            type="file"
                            accept="audio/*,video/*"
                            style={{ display: "none" }}
                            onChange={async (event) => {

                                const file = event.target.files[0]

                                if (!file) {
                                    return
                                }

                                // let the same file be picked again later
                                event.target.value = ""

                                // catch big files before spending the upload
                                if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
                                    setStatus(`file too big (${MAX_UPLOAD_MB}MB max)`)
                                    return
                                }

                                setStatus("uploading...")

                                const formData = new FormData()

                                formData.append(
                                    "file",
                                    file
                                )

                                try {
                                    const data = await apiFetch("/upload", {
                                        method: "POST",
                                        body: formData,
                                    })

                                    onTrackLoaded(data, "file")

                                    setStatus("uploaded ♡")
                                } catch (error) {
                                    setStatus(error.message)
                                }
                            }}
                        />

                        <p className="upload-note">
                            audio & video supported
                        </p>

                    </div>

                </div>

            </div>

        </section>
    )
}

export default SourcePanel