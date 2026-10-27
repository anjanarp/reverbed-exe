import { useState } from "react"

import { verifyAccessCode } from "../api"

// the inside joke: change this to whatever your friends will get
const ACCESS_HINT = "magic words ♡"

function AccessGate({ unlocked, onUnlock }) {
    const [code, setCode] = useState("")
    const [status, setStatus] = useState("")
    const [checking, setChecking] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()

        if (!code.trim() || checking) return

        setChecking(true)
        setStatus("")

        try {
            const result = await verifyAccessCode(code.trim())

            if (result.ok) {
                onUnlock()
            } else {
                setStatus(result.status === 429 ? "too many tries ♡" : "nope ✕")
                setCode("")
            }
        } catch {
            setStatus("can't reach server")
        } finally {
            setChecking(false)
        }
    }

    if (unlocked) {
        return (
            <div className="access-gate access-gate-open">
                <span>✦ ACCESS GRANTED ♡</span>
            </div>
        )
    }

    return (
        <form className="access-gate" onSubmit={handleSubmit}>
            <div className={`access-gate-row ${status ? "access-gate-error" : ""}`}>
                {/* a plain text box masked by hand, so password managers don't attach their icons */}
                <input
                    id="access-code"
                    className="youtube-input access-gate-input"
                    type="text"
                    name="reverbed-magic-words"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    aria-label="access code"
                    placeholder={status || ACCESS_HINT}
                    value={"*".repeat(code.length)}
                    onChange={() => { }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.metaKey || event.ctrlKey) return

                        if (event.key === "Backspace") {
                            event.preventDefault()
                            setCode(code.slice(0, -1))
                            setStatus("")
                        } else if (event.key.length === 1) {
                            event.preventDefault()
                            setCode(code + event.key)
                            setStatus("")
                        }
                    }}
                    onPaste={(event) => {
                        event.preventDefault()
                        setCode(code + event.clipboardData.getData("text").trim())
                        setStatus("")
                    }}
                />

                <button className="access-gate-button" disabled={checking}>
                    ▶
                </button>
            </div>
        </form>
    )
}

export default AccessGate
