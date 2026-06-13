import {Organ} from "@api/model/organ";
import {Song} from "@api/model/song";
import {Hole} from "@api/model/hole";

// TODO this should extend an iterable of holes instead of the field
class Column {
  holes: Hole[]

  constructor(holes?: Hole[]) {
    this.holes = holes ? holes : [];
  }

  // TODO public getter for holes so they are always ordered
}

// TODO this should extend an iterable of columns instead of the field
interface Grid {
  height: number;
  columns: Column[];
  rowNames: string[];
}

interface Tape {
  id: string
  organId: Organ["id"]
  songId?: Song["id"]
  grid: Grid
}
