export interface Note {
  id: string,
  pitch: number,
  name: string
}

export interface Profile {
  id: string,
  name: string,
  notes: Note[]
}

export function newProfile(
  id?: string,
  name?: string,
  notes?: Note[]
) {
  return {
    id: id ? id : crypto.randomUUID(),
    name: name ? name : 'new Profile',
    notes: notes ? notes : []
  }
}

export function newNote(
  id?: string,
  name?: string,
  pitch?: number
) {
  return {
    id: id ? id : crypto.randomUUID(),
    name: name ? name : 'new Note',
    pitch: pitch ? pitch : 0
  }
}
