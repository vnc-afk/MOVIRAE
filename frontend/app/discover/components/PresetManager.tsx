"use client";

import { memo } from "react";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Sparkles } from "lucide-react";
import type { FilterPreset, FilterState } from "../lib/types";

interface PresetManagerProps {
  presets: FilterPreset[];
  isLoading: boolean;
  onApply: (preset: FilterPreset) => void;
  onSave: (name: string, filters: FilterState) => Promise<boolean>;
  currentFilters: FilterState;
}

/**
 * Displays saved filter presets and allows creating new ones.
 */
export const PresetManager = memo(function PresetManager({
  presets,
  isLoading,
  onApply,
  onSave,
  currentFilters,
}: PresetManagerProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!presetName.trim()) return;

    setIsSaving(true);
    const success = await onSave(presetName, currentFilters);
    setIsSaving(false);

    if (success) {
      setPresetName("");
      setShowSaveForm(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Saved Presets</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onApply(preset)}
            className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
          >
            ✨ {preset.name}
          </button>
        ))}

        <button
          onClick={() => setShowSaveForm((current) => !current)}
          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Save className="h-3 w-3" /> Save Current
        </button>
      </div>

      <AnimatePresence>
        {showSaveForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 mt-2 max-w-sm">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name…"
                disabled={isSaving}
                className="flex-1 text-xs rounded-full bg-secondary pl-3 pr-3 py-1.5 border border-border focus:border-primary outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              />
              <button
                onClick={handleSave}
                disabled={isSaving || !presetName.trim()}
                className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
