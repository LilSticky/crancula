// noinspection ES6PreferShortImport

import {OrganPipes} from "@api/model/organPipes";
import {OrganPipe} from "@api/model/organPipe";
import {TapeConfig} from "@api/model/tapeConfig";

export type DriedOrgan = {
  id: string
  name: string
  tape: TapeConfig;
  pipes: OrganPipe[]
};

export interface OrganInterface {
  id: string
  // general
  name: string
  tape: TapeConfig;
  // pipe settings
  pipes: OrganPipes
}

export class Organ implements OrganInterface {
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
