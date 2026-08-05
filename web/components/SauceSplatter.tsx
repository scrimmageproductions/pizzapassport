interface SauceSplatterProps {
  className?: string;
  size?: number;
  rotation?: number;
  opacity?: number;
  color?: string;
}

/**
 * A decorative pizza-sauce splatter: an irregular cluster of overlapping
 * ellipses and droplet dots, built entirely from basic SVG shape
 * primitives (no hand-authored path data) so it always renders cleanly.
 * Purely decorative — always `aria-hidden`.
 */
export default function SauceSplatter({
  className = "",
  size = 120,
  rotation = 0,
  opacity = 0.85,
  color = "#8B1420",
}: SauceSplatterProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ transform: `rotate(${rotation}deg)`, opacity }}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="50" cy="48" rx="26" ry="22" fill={color} />
      <ellipse cx="34" cy="60" rx="12" ry="10" fill={color} />
      <ellipse cx="66" cy="34" rx="10" ry="13" fill={color} />
      <ellipse cx="60" cy="66" rx="9" ry="8" fill={color} />
      <circle cx="20" cy="30" r="6" fill={color} />
      <circle cx="82" cy="70" r="7" fill={color} />
      <circle cx="88" cy="30" r="4" fill={color} />
      <circle cx="14" cy="70" r="4.5" fill={color} />
      <circle cx="70" cy="12" r="3" fill={color} />
      <circle cx="12" cy="52" r="3" fill={color} />
    </svg>
  );
}
