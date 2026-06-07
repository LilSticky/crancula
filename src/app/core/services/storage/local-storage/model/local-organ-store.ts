import {DataStore} from "@api/index";
import {Organ} from "@api/model/organ";

export class OrganDataStore implements DataStore<Organ> {
  private readonly _key = "organs";

  async get(): Promise<Organ[]> {
    return new Promise(() => {
      const item = localStorage.getItem(this._key);
      if (item) {
        return JSON.parse(item) as Organ[];
      } else {
        console.debug("no item in local storage for ", this._key)
        return []
      }
    })
  }

  async set(values: Organ[]): Promise<void> {
    console.debug("set organs", values)
    return new Promise(() => {
      localStorage.setItem(this._key, JSON.stringify(values))
    })
  }
}
