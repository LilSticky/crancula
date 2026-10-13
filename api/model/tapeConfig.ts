/**
 * contains all information required to initialize a {@link Tape} for this {@link Organ}
 */
export interface TapeConfig {
  // tape settings
  tapeWidthMm: number
  tapeBorderMm: number
  // hole settings
  holeDiameterMm: number
  holeSpacingMm: number
}
