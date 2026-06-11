export class Pipe {
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
}
