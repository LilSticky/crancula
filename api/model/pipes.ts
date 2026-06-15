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
  public remove(pipe: Pipe): this {
    // remove exact match
    this.pipes = this.pipes.filter(p => !pipe.equals(p));
    // close potential gaps in index
    this.index();
    return this
  }

  /** Moved pipe from one index to the other and shift pipes in between up by one. */
  public move(from: number, to: number): this {
    if (from < 0 || from >= this.pipes.length || to < 0 || to >= this.pipes.length) {
      throw new RangeError("Index out of bounds");
    }
    const [item] = this.pipes.splice(from, 1);
    this.pipes.splice(to, 0, item);
    return this.index()
  }

  /** Appends a {@link Pipe} to this collection. Ignores given {@link Pipe#index} to keep index intact */
  public add(pipe: Pipe): this {
    if (!pipe) return this;
    pipe.index = this.pipes.length;
    this.pipes = [...this.pipes, pipe]
    return this;
  }

  /** Reassign each internal {@link Pipe#index} with the current index */
  private index(): this {
    this.pipes.forEach((pipe, index) => pipe.index = index)
    return this
  }

  /** Sort this by current internal {@link Pipe#index}. */
  public sort(): this {
    this.pipes.sort((a, b) => a.index - b.index)
    return this
  }

  /** Simple representation for storage */
  public toArray(): Pipe[] {
    return this.pipes
  }

  public length(): number {
    return this.pipes.length
  }
}
