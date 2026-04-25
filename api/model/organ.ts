// noinspection ES6PreferShortImport

import {Pipe} from "../../api/model/pipe";

export class Organ {
  id: string
  name: string
  pipes: Pipe[]

  constructor(
    id?: string,
    name?: string,
    pipes?: Pipe[]
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Organ'
    this.pipes = pipes ? pipes : []
  }
}
