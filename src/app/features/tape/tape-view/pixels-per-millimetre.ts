export type Zoom = '1:1' | '2:1' | 'whole';

const SCREEN_PIXELS_PER_MILLIMETRE = 96 / 25.4;

/** The scale of the stage: 1:1 is true size on screen at 96 px per inch. */
export function pixelsPerMillimetre(zoom: Zoom, stageWidthPx: number, tapeLengthMm: number): number {
  switch (zoom) {
    case '1:1':
      return SCREEN_PIXELS_PER_MILLIMETRE;
    case '2:1':
      return 2 * SCREEN_PIXELS_PER_MILLIMETRE;
    case 'whole':
      return stageWidthPx / tapeLengthMm;
  }
}
