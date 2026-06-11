export class Hole {
  // primary state
  opened: boolean
  // may stretch to extend note
  length: number

  constructor(
    punched: boolean,
    length?: number
  ) {
    this.opened = punched ?? false
    this.length = length ? length : 1;
  }
}
