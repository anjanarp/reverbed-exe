import RenamableList from "./RenamableList"

function formatLength(seconds) {
    if (!seconds) return "--:--"

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function HistoryPanel({ history, activeTrackId, onSelect, onRename, onRemove }) {
    return (
        <section className="history-panel">
            <div className="history-content">
                <p className="history-hint">
                    click to load · double-click to rename
                </p>

                {history.length === 0 ? (
                    <p className="history-empty">
                        no tracks yet ♡
                    </p>
                ) : (
                    <RenamableList
                        items={history}
                        activeId={activeTrackId}
                        renderIcon={(track) => ({ youtube: "▶", soundcloud: "☁" })[track.source] || "♪"}
                        renderDetail={(track) => formatLength(track.duration)}
                        onSelect={onSelect}
                        onRename={onRename}
                        onRemove={onRemove}
                        removeTitle="remove from history"
                    />
                )}
            </div>
        </section>
    )
}

export default HistoryPanel
