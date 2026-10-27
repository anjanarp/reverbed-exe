// the backend's address; set VITE_API_URL when building for Cloud Run
export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")

const CODE_KEY = "reverbed-access-code"

// kept for this tab only, so a refresh doesn't make friends type it again
let accessCode = ""

try {
    accessCode = sessionStorage.getItem(CODE_KEY) || ""
} catch {
    // storage blocked; the code just won't survive a refresh
}

export function getAccessCode() {
    return accessCode
}

function setAccessCode(code) {
    accessCode = code

    try {
        sessionStorage.setItem(CODE_KEY, code)
    } catch {
        // see above
    }
}

export function apiUrl(path) {
    return `${API_URL}${path}`
}

// short, friendly messages for the status line
export function describeError(status, detail) {
    if (status === 401) return "access code needed ♡"
    if (status === 429) return "slow down ♡ try again later"
    if (status === 413) return `file too big (${detail})`
    if (status === 422) return detail || "couldn't use that file"
    if (status === 400) return detail || "that link didn't work"
    if (status === 502 || status === 503) return detail || "youtube didn't cooperate"

    return "something went wrong"
}

export async function apiFetch(path, options = {}) {
    const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
            ...options.headers,
            "X-Access-Code": accessCode,
        },
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const error = new Error(describeError(response.status, body.detail))

        error.status = response.status
        throw error
    }

    return response.json()
}

export async function verifyAccessCode(code) {
    const response = await fetch(apiUrl("/verify"), {
        method: "POST",
        headers: { "X-Access-Code": code },
    })

    if (response.ok) {
        setAccessCode(code)
        return { ok: true }
    }

    return { ok: false, status: response.status }
}

// tells the server to delete tracks; works even while the page is unloading
export function cleanupTracks(trackIds) {
    if (!trackIds.length || !accessCode) return

    const body = new Blob(
        [JSON.stringify({ code: accessCode, track_ids: trackIds })],
        { type: "text/plain" }
    )

    navigator.sendBeacon(apiUrl("/cleanup"), body)
}
