import {Organ} from "@api/model/organ";
import {TapeConfig} from "@api/model/tapeConfig";
import {OrganPipe} from "@api/model/organPipe";
import {OrganPipes} from "@api/model/organPipes";

export class FormOrgan implements Omit<Organ, 'pipes'> {
  id: string;
  name: string;
  tape: TapeConfig;
  pipes: OrganPipe[];

  constructor(organ: Organ = new Organ) {
    this.id = organ.id;
    this.name = organ.name;
    this.tape = organ.tape;
    this.pipes = organ.pipes.toArray();
  }

  get get(): Organ {
    return {...this, pipes: new OrganPipes(this.pipes)}
  }
}
