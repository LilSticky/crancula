export class Song {
  id?: string
  title: string
  sourceFormat?: string

  // TODO this should store all musical information needed to create musical scores or punched tapes
  constructor(
    title: string
  ) {
    this.id = crypto.randomUUID()
    this.title = title
  }
}
