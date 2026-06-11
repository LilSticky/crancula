export interface DataStore<T> {

  set(values: T[]): Promise<void>;

  get(): Promise<T[]>;
}

export {Organ} from './model/organ';
export {Pipe} from './model/pipe';
export {Hole} from './model/hole';
export {Tape} from './model/tape';
export {Song} from './model/song';

