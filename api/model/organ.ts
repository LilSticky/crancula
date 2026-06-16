// noinspection ES6PreferShortImport

import {OrganPipes} from "@api/model/organPipes";
import {OrganPipe} from "@api/model/organPipe";

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

export type DriedOrgan = {
  id: string
  name: string
  tape: TapeConfig;
  pipes: OrganPipe[]
};

export class Organ {
  id: string
  // general
  name: string
  tape: TapeConfig;
  // pipe settings
  pipes: OrganPipes

  constructor(
    id?: string,
    name?: string,
    pipes?: OrganPipe[],
    tape?: TapeConfig
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Organ'
    this.pipes = pipes ? new OrganPipes(pipes) : new OrganPipes([])
    this.tape = {
      tapeWidthMm: tape?.tapeWidthMm ? tape.tapeWidthMm : 0,
      tapeBorderMm: tape?.tapeBorderMm ? tape.tapeBorderMm : 0,
      holeDiameterMm: tape?.holeDiameterMm ? tape.holeDiameterMm : 0,
      holeSpacingMm: tape?.holeSpacingMm ? tape.holeSpacingMm : 0,
    }
  }
}
