// @ts-nocheck
import fs from 'fs';
import path from 'path';

export class JsonStore<T> {
  private data: Map<string, T> = new Map();
  private file: string;

  constructor(filename: string) {
    const dir = process.env.VERCEL ? "/tmp" : process.cwd();
    this.file = path.join(dir, filename);
    this.load();
  }

  private load() {
    if (fs.existsSync(this.file)) {
      try {
        const json = fs.readFileSync(this.file, 'utf-8');
        const parsed = JSON.parse(json);
        for (const key in parsed) {
          this.data.set(key, parsed[key]);
        }
      } catch (e) {
        console.error('Failed to load store', this.file, e);
      }
    }
  }

  private save() {
    const obj = Object.fromEntries(this.data);
    fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
  }

  get(key: string): T | undefined {
    return this.data.get(key);
  }

  set(key: string, value: T) {
    this.data.set(key, value);
    this.save();
  }

  values(): T[] {
    return Array.from(this.data.values());
  }

  delete(key: string) {
    this.data.delete(key);
    this.save();
  }
}
