"use client";

import type { AxisResearchCategoryId } from "../content-types";
import { groupedAxisResearchCategories } from "./satya-client";

/**
 * Axis Research category chips for the Satya companion and the M-2 Briefing
 * Room. Extracted from `SatyaPresence.tsx` to keep that file under the
 * 1000-line rule while the persona work grows the avatar.
 */
export function SatyaAxisCategoryChips({
  selected,
  onToggle,
  onAsk,
  counts,
  compact = false,
  disabled = false,
}: {
  selected: AxisResearchCategoryId[];
  onToggle: (id: AxisResearchCategoryId) => void;
  onAsk?: (id: AxisResearchCategoryId, label: string) => void;
  counts?: Partial<Record<AxisResearchCategoryId, number>>;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`satya-axis-chips${compact ? " satya-axis-chips-compact" : ""}`} role="group" aria-label="Axis Research categories">
      {groupedAxisResearchCategories().map((group) => (
        <div key={group.id} className="satya-axis-chip-group" role="group" aria-label={group.label}>
          <em>{group.label}</em>
          {group.hint ? <p className="satya-webinar-hint">{group.hint}</p> : null}
          {group.categories.map((category) => {
            const id = category.id;
            const count = counts?.[id];
            const pressed = selected.includes(id);
            return (
              <span key={id} className="satya-axis-chip-wrap">
                <button
                  type="button"
                  className="satya-axis-chip"
                  aria-pressed={pressed}
                  data-axis-category={id}
                  disabled={disabled}
                  style={{ "--axis-chip-accent": `var(${category.colorToken})` } as CSSProperties}
                  onClick={() => onToggle(id)}
                >
                  {category.label}
                  {typeof count === "number" ? <span>{count}</span> : null}
                </button>
                {onAsk ? (
                  <button
                    type="button"
                    className="satya-axis-ask"
                    disabled={disabled}
                    data-axis-category={id}
                    aria-label={`Ask this category: ${category.label}`}
                    onClick={() => onAsk(id, category.label)}
                  >
                    Ask
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
