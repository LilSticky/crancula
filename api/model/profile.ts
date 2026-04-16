export interface Profile {
  id: string,
  name: string,
  notes: string[]
}

export function newProfile(
  id?: string,
  name?: string,
  notes?: string[]
) {
  return {
    id: id ? id : crypto.randomUUID(),
    name: name ? name : 'new Profile',
    notes: notes ? notes : []
  }
}
