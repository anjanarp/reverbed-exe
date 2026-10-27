import { useRef, useState } from "react"

// click to select, double-click a name to rename, hover to remove
function RenamableList({ items, activeId, renderIcon, renderDetail, onSelect, onRename, onRemove, removeTitle }) {
    const [editingId, setEditingId] = useState(null)
    const [draftName, setDraftName] = useState("")
    const clickTimerRef = useRef(null)

    function handleClick(item) {
        // wait a beat so a double-click (rename) doesn't also select the item
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = setTimeout(() => onSelect(item), 220)
    }

    function startEditing(item) {
        clearTimeout(clickTimerRef.current)
        setEditingId(item.id)
        setDraftName(item.name)
    }

    function commitEdit() {
        const name = draftName.trim()

        if (name) {
            onRename(editingId, name)
        }

        setEditingId(null)
    }

    return (
        <ul className="history-list">
            {items.map((item, index) => (
                <li
                    key={item.id}
                    className={`history-item ${item.id === activeId ? "history-item-active" : ""}`}
                    onClick={() => editingId !== item.id && handleClick(item)}
                >
                    <span className="history-index">
                        {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="history-source">
                        {renderIcon(item)}
                    </span>

                    {editingId === item.id ? (
                        <input
                            className="history-rename-input"
                            value={draftName}
                            autoFocus
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => setDraftName(event.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") commitEdit()
                                if (event.key === "Escape") setEditingId(null)
                            }}
                        />
                    ) : (
                        <span
                            className="history-name"
                            title={item.name}
                            onDoubleClick={() => startEditing(item)}
                        >
                            {item.name}
                        </span>
                    )}

                    {renderDetail && (
                        <span className="history-detail">
                            {renderDetail(item)}
                        </span>
                    )}

                    <button
                        className="history-remove"
                        title={removeTitle}
                        onClick={(event) => {
                            event.stopPropagation()
                            onRemove(item.id)
                        }}
                    >
                        ✕
                    </button>
                </li>
            ))}
        </ul>
    )
}

export default RenamableList
