/** The part of the overview strip that mirrors what the stage shows. */
export interface OverviewFrame {
  readonly x: number;
  readonly width: number;
}

/** Where the stage's visible part lies in the overview strip; the whole strip when the drawing fits the stage. */
export function overviewFrame(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  overviewWidth: number,
): OverviewFrame {
  if (scrollWidth <= clientWidth) return {x: 0, width: overviewWidth};
  const ratio = overviewWidth / scrollWidth;
  return {x: scrollLeft * ratio, width: clientWidth * ratio};
}

/** The scroll position that centres the point clicked in the overview, kept inside the drawing. */
export function scrollLeftFor(clickX: number, overviewWidth: number, scrollWidth: number, clientWidth: number): number {
  const centred = (clickX / overviewWidth) * scrollWidth - clientWidth / 2;
  return Math.max(0, Math.min(centred, scrollWidth - clientWidth));
}
