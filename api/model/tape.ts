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
class Grid {
  height: number;
  columns: Column[];
  rowNames: string[];

  constructor(organ: Organ, song?: Song) {
    // each column must be in the same order as these pipes
    const pipes = organ.pipes.sort((a, b) => a.index - b.index);
    // noinspection JSSuspiciousNameCombination rotation is intentional
    this.height = organ.tapeWidthMm;
    // TODO if song is present use a converter to convert the song to columns
    this.columns = []
    this.rowNames = pipes.map(pipe => pipe.name);
  }
}

export class Tape {
  id: string
  organId: Organ["id"]
  songId?: Song["id"]
  grid: Grid

  constructor(organ: Organ, id?: string, song?: Song, grid?: Grid) {
    this.id = id ? id : crypto.randomUUID();
    this.organId = organ.id;
    this.grid = grid ? grid : new Grid(organ, song);
    this.songId = song?.id;
  }
}
