export class OrganPipe {
  index: number
  pitch: number
  name: string

  constructor(
    index?: number,
    name?: string,
    pitch?: number
  ) {
    this.index = index ? index : 0
    this.name = name ? name : ''
    this.pitch = pitch ? pitch : 0
  }

  equals(pipe: OrganPipe) {
    return this.index === pipe.index && this.pitch === pipe.pitch && this.name === pipe.name;
  }

  setIndex(index: number) {
    this.index = index
  }
}
