// saving straight into a folder needs the File System Access API (Chrome / Edge)
export const canSaveToFolder = typeof window !== "undefined" && "showDirectoryPicker" in window

const DB_NAME = "reverbed"
const STORE = "handles"
const FOLDER_KEY = "spotify-folder"

// the chosen folder lives in this browser's IndexedDB, never on the server
function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)

        request.onupgradeneeded = () => request.result.createObjectStore(STORE)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function withStore(mode, action) {
    const db = await openDb()

    return new Promise((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE))

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

export async function loadSavedFolder() {
    if (!canSaveToFolder) return null

    try {
        return (await withStore("readonly", (store) => store.get(FOLDER_KEY))) || null
    } catch {
        return null
    }
}

export async function chooseFolder() {
    const folder = await window.showDirectoryPicker({ id: "reverbed-spotify", mode: "readwrite" })

    try {
        await withStore("readwrite", (store) => store.put(folder, FOLDER_KEY))
    } catch {
        // couldn't remember it; it still works for this visit
    }

    return folder
}

// browsers ask again after a reload; this has to run from a click
async function ensurePermission(folder) {
    const options = { mode: "readwrite" }

    if ((await folder.queryPermission(options)) === "granted") return true

    return (await folder.requestPermission(options)) === "granted"
}

async function fileExists(folder, name) {
    try {
        await folder.getFileHandle(name)
        return true
    } catch {
        return false
    }
}

export async function saveToFolder(folder, baseName, blob) {
    if (!(await ensurePermission(folder))) {
        throw new Error("folder permission denied")
    }

    // never overwrite an earlier export
    let name = `${baseName}.mp3`

    for (let copy = 2; await fileExists(folder, name); copy++) {
        name = `${baseName} ${copy}.mp3`
    }

    const file = await folder.getFileHandle(name, { create: true })
    const writable = await file.createWritable()

    await writable.write(blob)
    await writable.close()

    return name
}
