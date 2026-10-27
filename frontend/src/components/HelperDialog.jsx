import { useState } from "react"

const RUN_COMMAND = "python3 ~/Downloads/reverbed-helper.py"

function HelperDialog({ onClose }) {
    const [copied, setCopied] = useState(false)

    async function copyCommand() {
        try {
            await navigator.clipboard.writeText(RUN_COMMAND)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // clipboard blocked; the command is still on screen to copy by hand
        }
    }

    return (
        <div className="helper-backdrop" onMouseDown={onClose}>
            <section
                className="helper-window"
                role="dialog"
                aria-labelledby="helper-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="helper-titlebar">
                    <span id="helper-title">✦ reverbed helper</span>

                    <button className="helper-close" title="close" onClick={onClose}>
                        ✕
                    </button>
                </header>

                <div className="helper-body">
                    <p className="helper-lead">
                        youtube blocks our server, so youtube imports run through <b>your computer</b> instead.
                    </p>

                    <p className="helper-note">
                        the helper is a tiny script that only downloads the audio of links you paste here.
                        no accounts, nothing saved, and it stops when you close it.
                    </p>

                    <ol className="helper-steps">
                        <li>
                            <a className="upload-button helper-download" href="/reverbed-helper.py" download>
                                ✦ DOWNLOAD HELPER ☆
                            </a>
                        </li>

                        <li>
                            open <b>Terminal</b> and run:
                            <button className="helper-command" title="copy" onClick={copyCommand}>
                                <code>{RUN_COMMAND}</code>
                                <span>{copied ? "copied ♡" : "copy"}</span>
                            </button>
                            <span className="helper-small">windows: <code>py reverbed-helper.py</code> from Downloads</span>
                        </li>

                        <li>
                            leave that window open, then hit <b>IMPORT</b> again. if chrome asks to
                            access devices on your local network, click <b>allow</b>.
                        </li>
                    </ol>

                    <p className="helper-small helper-footer">
                        no python, or on your phone? <b>upload local file</b> always works ♡
                    </p>
                </div>
            </section>
        </div>
    )
}

export default HelperDialog
