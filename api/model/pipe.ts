export class Pipe {
  id: string
  pitch: number
  name: string

  constructor(
    id?: string,
    name?: string,
    pitch?: number
  ) {
    this.id = id ? id : crypto.randomUUID()
    this.name = name ? name : 'new Note'
    this.pitch = pitch ? pitch : 0
  }
}
