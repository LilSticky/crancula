// noinspection ES6PreferShortImport

import {Pipe} from "../../api/model/pipe";

export class Organ {
  id: string
  name: string
  pipes: Pipe[]
  tapeWidthMm: number
  holeDiameterMm: number
  holeSpacingMm: number
  rowHeighMm: number
  columnWidthMm: number

  constructor(
    id?: string,
    name?: string,
    pipes?: Pipe[],
    tapeWidthMm?: number,
    holeDiameterMm?: number,
    holeSpacingMm?: number,
    rowHeighMm?: number,
    columnWidthMm?: number,
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Organ'
    this.pipes = pipes ? pipes : []
    this.tapeWidthMm = tapeWidthMm ? tapeWidthMm : 0;
    this.holeDiameterMm = holeDiameterMm ? holeDiameterMm : 0;
    this.holeSpacingMm = holeSpacingMm ? holeSpacingMm : 0;
    this.rowHeighMm = rowHeighMm ? rowHeighMm : 0;
    this.columnWidthMm = columnWidthMm ? columnWidthMm : 0;
  }
}
