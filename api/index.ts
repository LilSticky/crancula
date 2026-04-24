export interface DataStore<T> {

  set(values: T[]): Promise<void>;

  get(): Promise<T[]>;
}

