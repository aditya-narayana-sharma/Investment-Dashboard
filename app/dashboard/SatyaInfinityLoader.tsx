/**
 * Vertical figure-8 / infinity dot loader shown while Satya is working.
 * Inline SVG sized in `em` (height: 1em via CSS) so it is always exactly the
 * height of the surrounding text. Dots trace a vertical ∞ (stacked 8) via SMIL
 * animateMotion; under prefers-reduced-motion they render as a static column.
 * Presentational only (aria-hidden) — the status phrase carries the a11y text.
 */
const FIG8_PATH =
  "M8.5 17 C3 13 3 4 8.5 4 C14 4 14 13 8.5 17 C3 21 3 30 8.5 30 C14 30 14 21 8.5 17";
const FIG8_DELAYS = ["0s", "-0.48s", "-0.96s", "-1.44s", "-1.92s"];
// Static column positions along the 8 for reduced-motion.
const FIG8_STATIC = [
  [8.5, 5.5],
  [8.5, 11],
  [8.5, 17],
  [8.5, 23],
  [8.5, 28.5],
];

export function SatyaInfinityLoader({
  className = "",
  reducedMotion = false,
}: {
  className?: string;
  reducedMotion?: boolean;
}) {
  return (
    <svg
      className={["satya-fig8", className].filter(Boolean).join(" ")}
      viewBox="0 0 17 34"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {FIG8_STATIC.map(([cx, cy], index) =>
        reducedMotion ? (
          <circle key={index} cx={cx} cy={cy} r={2.1} />
        ) : (
          <circle key={index} r={2.1} cx={0} cy={0}>
            <animateMotion
              dur="2.4s"
              repeatCount="indefinite"
              path={FIG8_PATH}
              begin={FIG8_DELAYS[index]}
              calcMode="linear"
            />
          </circle>
        ),
      )}
    </svg>
  );
}
