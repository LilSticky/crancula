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

  /** Move a {@link Pipe} up by one. Move other pipe when necessary. Cannot handle new pipes. */
  public moveUp(pipe: Pipe): void {
    if (pipe.index <= 0) {
      this.prepend(pipe);
    } else {
      const newIndex = pipe.index - 1;
      const valueAtTarget = this.pipes.at(newIndex);
      if (valueAtTarget) {
        this.moveUp(valueAtTarget);
      }
      this.pipes[newIndex] = pipe
    }
  }

  /** Move a {@link Pipe} down by one. Move other pipe when necessary. Cannot handle new pipes. */
  public moveDown(pipe: Pipe): void {
    if (pipe.index >= this.pipes.length) {
      this.append(pipe);
    } else {
      const newIndex = pipe.index + 1;
      const valueAtTarget = this.pipes.at(newIndex);
      if (valueAtTarget) {
        this.moveDown(valueAtTarget);
      }
      this.pipes[newIndex] = pipe
    }
  }


  /** Appends a {@link Pipe} to this collection. Ignores given {@link Pipe#index}  */
  public append(pipe: Pipe): void {
    pipe.index = this.pipes.length;
    this.pipes = [...this.getModified(-1), pipe]
  }

  /** Prepends a {@link Pipe} to this collection. Ignores given {@link Pipe#index} */
  public prepend(pipe: Pipe): void {
    pipe.index = 0;
    this.pipes = [pipe, ...(this.getModified(+1))]
  }

  /** Get a copy with each {@link Pipe#index} modified. Designed to work for +1 and -1 */
  private getModified(modifier: number) {
    return this.pipes.map(pipe => {
      pipe.setIndex(pipe.index + modifier)
      return pipe
    });
  }

  /** Reassign each internal {@link Pipe#index}. Uses current order. */
  private index() {
    this.pipes.forEach((pipe, index) => pipe.index = index)
  }

  /** Sort this by current {@link Pipe#index}. */
  private sort() {
    this.pipes.sort((a, b) => a.index - b.index)
  }
}
