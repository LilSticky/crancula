import {Pipe} from "@api/model/pipe";

export class Organ {
  id: string
  name: string
  notes: Pipe[]

  constructor(
    id?: string,
    name?: string,
    notes?: Pipe[]
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Profile'
    this.notes = notes ? notes : []
  }
}
