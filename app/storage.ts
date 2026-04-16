import {promises as fs} from "fs";
import path from "path";

type WithId = {
  id: string;
};

export class FileStorage<T extends WithId> {
  private filePath: string;

  constructor(collectionName: string) {
    this.filePath = path.join(__dirname, "db", `${collectionName}.json`);
  }

  private async read(): Promise<T[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data) as T[];
    } catch (err: any) {
      if (err.code === "ENOENT") {
        await this.write([]);
        return [];
      }
      throw err;
    }
  }

  private async write(data: T[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async getAll(): Promise<T[]> {
    return this.read();
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.read();
    return items.find(item => item.id === id) || null;
  }

  async create(item: T): Promise<T> {
    const items = await this.read();

    const exists = items.some(i => i.id === item.id);
    if (exists) {
      throw new Error(`Item with id ${item.id} already exists`);
    }

    items.push(item);
    await this.write(items);

    return item;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const items = await this.read();

    const index = items.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updated = { ...items[index], ...updates, id };
    items[index] = updated;

    await this.write(items);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const items = await this.read();
    const filtered = items.filter(i => i.id !== id);

    await this.write(filtered);
  }
}
