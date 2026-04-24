import {promises as fs} from "fs";
import path from "path";

type WithId = {
  id: string;
};

export class FileStorage<T extends WithId> {
  private readonly filePath: string;

  constructor(collectionName: string) {
    this.filePath = path.join(__dirname, "db", `${collectionName}.json`);
  }

  handleGet() {
    return (_: any) => this.get();
  }

  handleSet() {
    return (_: any, values: T[]) => this.set(values);
  }

  async get(): Promise<T[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data) as T[];
    } catch (err: any) {
      if (err.code === "ENOENT") {
        await this.set([]);
        return [];
      }
      throw err;
    }
  }

  async set(data: T[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async getOne(id: string): Promise<T | null> {
    const items = await this.get();
    return items.find(item => item.id === id) || null;
  }

  async setOne(item: T): Promise<T> {
    const items = await this.get();

    const exists = items.some(i => i.id === item.id);
    if (exists) {
      throw new Error(`Item with id ${item.id} already exists`);
    }

    items.push(item);
    await this.set(items);

    return item;
  }
}
