/** Inline info icon with hover tooltip — accessibility-friendly. */
export function InfoIcon({ tip }: { tip: string }) {
  return (
    <span className="econ-info-wrap" tabIndex={0} aria-label={tip}>
      <span className="econ-info-icon" aria-hidden="true">i</span>
      <span className="econ-tooltip" role="tooltip">{tip}</span>
    </span>
  );
}
