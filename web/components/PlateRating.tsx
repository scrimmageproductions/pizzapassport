"use client";

import { useState } from "react";
import clsx from "clsx";

interface PlateRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<PlateRatingProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

function fillLevelFor(value: number, plate: number): "full" | "half" | "empty" {
  const diff = value - (plate - 1);
  if (diff >= 1) return "full";
  if (diff >= 0.5) return "half";
  return "empty";
}

/**
 * 1.0–5.0 Plate rating control, in 0.5-Plate increments — Pizza Passport's
 * answer to a star rating. Click the left half of a plate for a half
 * rating, the right half for a whole one. Pass `readOnly` to render a
 * static breakdown (e.g. inside an entry detail view).
 */
export default function PlateRating({ value, onChange, readOnly = false, size = "md" }: PlateRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const displayValue = hover ?? value;

  function pick(plate: number, event: React.MouseEvent<HTMLButtonElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    return plate - (isLeftHalf ? 0.5 : 0);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((plate) => {
          const level = fillLevelFor(displayValue, plate);
          return (
            <button
              key={plate}
              type="button"
              disabled={readOnly}
              onMouseMove={(e) => !readOnly && setHover(pick(plate, e))}
              onClick={(e) => !readOnly && onChange?.(pick(plate, e))}
              className={clsx(
                SIZE_CLASSES[size],
                "relative leading-none transition",
                readOnly ? "cursor-default" : "cursor-pointer active:scale-90"
              )}
              aria-label={`Rate ${plate} plates`}
            >
              <span className="text-white/15">🍽️</span>
              {level !== "empty" ? (
                <span
                  className="absolute inset-0 overflow-hidden text-crust"
                  style={{ clipPath: level === "half" ? "inset(0 50% 0 0)" : "inset(0 0 0 0)" }}
                >
                  🍽️
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <span className="text-sm font-semibold text-crust">{displayValue.toFixed(1)} Plates</span>
    </div>
  );
}
