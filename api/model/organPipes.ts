import {OrganPipe} from "@api/model/organPipe";

/**
 * Iterable sorted collection of {@link OrganPipe}s.
 */
export class OrganPipes implements Iterable<OrganPipe> {
  private pipes: OrganPipe[];

  constructor(pipes: OrganPipe[]) {
    this.pipes = pipes
    this.sort()
  }

  [Symbol.iterator](): Iterator<OrganPipe> {
    return this.pipes[Symbol.iterator]();
  }

  /** Removes exact matches from this collection. Reassigns index after */
  public remove(pipe: OrganPipe): this {
    // remove exact match
    this.pipes = this.pipes.filter(p => !pipe.equals(p));
    // close potential gaps in index
    this.index();
    return this
  }

  /** Moved pipe from one index to the other and shift pipes in between up by one. */
  public move(from: number, to: number): this {
    const length = this.length();
    console.log(length, from, to)
    if (from < 0 || from >= length || to < 0 || to >= length) {
      throw new RangeError("Index out of bounds");
    }
    const [item] = this.pipes.splice(from, 1);
    this.pipes.splice(to, 0, item);
    return this.index()
  }

  /** Appends a {@link OrganPipe} to this collection. Ignores given {@link OrganPipe#index} to keep index intact */
  public add(pipe: OrganPipe): this {
    if (!pipe) return this;
    pipe.index = this.pipes.length;
    this.pipes = [...this.pipes, pipe]
    return this;
  }

  /** Reassign each internal {@link OrganPipe#index} with the current index */
  private index(): this {
    this.pipes.forEach((pipe: OrganPipe, index: number) => pipe.index = index)
    return this
  }

  /** Sort this by current internal {@link OrganPipe#index}. */
  public sort(): this {
    this.pipes.sort((a, b) => a.index - b.index)
    return this
  }

  /** Simple representation for storage */
  public toArray(): OrganPipe[] {
    return this.pipes
  }

  public length(): number {
    return this.pipes.length
  }
}
