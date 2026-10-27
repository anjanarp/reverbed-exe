import RenamableList from "./RenamableList"
import { getEffectSettings } from "../audio/effectSettings"

function PresetsPanel({ presets, activePresetId, onSave, onApply, onRename, onRemove }) {
    return (
        <section className="presets-panel">
            <div className="presets-content">
                <button
                    className="presets-save-button"
                    onClick={onSave}
                >
                    SAVE PRESET
                </button>

                {presets.length === 0 ? (
                    <p className="history-empty presets-empty">
                        no presets yet ♡
                    </p>
                ) : (
                    <RenamableList
                        items={presets}
                        activeId={activePresetId}
                        renderIcon={() => "✦"}
                        renderDetail={(preset) => `${getEffectSettings(preset.settings).playbackRate.toFixed(2)}x`}
                        onSelect={onApply}
                        onRename={onRename}
                        onRemove={onRemove}
                        removeTitle="delete preset"
                    />
                )}
            </div>
        </section>
    )
}

export default PresetsPanel
