import sourceWindow from "../assets/source-window.png"
import planetIcon from "../assets/planet-icon.png"

import { useState } from "react"

import { apiFetch } from "../api"

const MAX_UPLOAD_MB = 50

function SourcePanel({ onTrackLoaded }) {

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
                        YouTube URL
                    </p>

                    <input
                        className="youtube-input"
                        placeholder="https://youtu.be/..."
                        value={youtubeUrl}
                        onChange={(event) => setYoutubeUrl(event.target.value)}
                    />

                    <button
                        className="import-button"
                        onClick={async () => {
                            setStatus("importing...")

                            try {
                                const data = await apiFetch("/download", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        url: youtubeUrl,
                                    }),
                                })

                                onTrackLoaded(data, "youtube")

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