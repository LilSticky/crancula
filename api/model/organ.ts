// noinspection ES6PreferShortImport

import {Pipe} from "../../api/model/pipe";

/**
 * contains all information required to initialize a {@link Tape} for this {@link Organ}
 */
interface TapeConfig {
  // tape settings
  tapeWidthMm: number
  tapeBorderMm: number
  // hole settings
  holeDiameterMm: number
  holeSpacingMm: number
}

export class Organ {
  id: string
  // general
  name: string
  tape: TapeConfig;
  // pipe settings
  pipes: Pipe[]

  constructor(
    id?: string,
    name?: string,
    pipes?: Pipe[],
    tapeWidthMm?: number,
    holeDiameterMm?: number,
    holeSpacingMm?: number,
    tapeBorderMm?: number,
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Organ'
    this.pipes = pipes ? pipes : []
    this.tape = {
      tapeWidthMm: tapeWidthMm ? tapeWidthMm : 0,
      tapeBorderMm: tapeBorderMm ? tapeBorderMm : 0,
      holeDiameterMm: holeDiameterMm ? holeDiameterMm : 0,
      holeSpacingMm: holeSpacingMm ? holeSpacingMm : 0,
    }
  }
}
