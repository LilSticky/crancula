import {Pipe} from "@api/model/pipe";
import Iterator = NodeJS.Iterator;

/**
 * Iterable sorted collection of {@link Pipe}s.
 */
export class Pipes implements Iterable<Pipe> {
  private pipes: Pipe[];

  constructor(pipes: Pipe[]) {
    this.pipes = pipes
    this.sort()
  }

  [Symbol.iterator](): Iterator<Pipe> {
    return this.pipes[Symbol.iterator]();
  }

  /** Removes exact matches from this collection. Reassigns index after */
  public remove(pipe: Pipe): void {
    // remove exact match
    this.pipes = this.pipes.filter(p => !p.equals(pipe));
    // close potential gaps in index
    this.index()
  }

  /** Moved pipe from one index to the other and shift pipes in between up by one. */
  move(from: number, to: number): void {
    if (from < 0 || from >= this.pipes.length || to < 0 || to >= this.pipes.length) {
      throw new RangeError("Index out of bounds");
    }
    const [item] = this.pipes.splice(from, 1);
    this.pipes.splice(to, 0, item);
    this.index()
  }

  /** Appends a {@link Pipe} to this collection. Ignores given {@link Pipe#index} to keep index intact */
  public add(pipe: Pipe): void {
    pipe.index = this.pipes.length;
    this.pipes = [...this.pipes, pipe]
  }

  /** Reassign each internal {@link Pipe#index} with the current index */
  private index() {
    this.pipes.forEach((pipe, index) => pipe.index = index)
  }

  /** Sort this by current internal {@link Pipe#index}. */
  public sort() {
    this.pipes.sort((a, b) => a.index - b.index)
  }
}
