// the reverbed helper runs on the visitor's own computer and fetches youtube audio,
// since youtube blocks the cloud server (see public/reverbed-helper.py)
const HELPER_URL = "http://127.0.0.1:47321"

// only called when someone clicks IMPORT, so chrome's "local network" prompt
// never shows up for people who don't use youtube import
export async function helperAvailable() {
    try {
        const response = await fetch(`${HELPER_URL}/health`, { signal: AbortSignal.timeout(2000) })
        const body = await response.json()

        return body.app === "reverbed-helper"
    } catch {
        return false
    }
}

export async function importViaHelper(url) {
    const response = await fetch(`${HELPER_URL}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || "the helper couldn't get that one")
    }

    const title = decodeURIComponent(response.headers.get("X-Title") || "untitled")
    const audio = await response.blob()

    return {
        track_id: crypto.randomUUID(),
        status: "downloaded",
        title,
        audio_url: URL.createObjectURL(audio),
    }
}
