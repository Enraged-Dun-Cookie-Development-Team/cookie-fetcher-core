import { DataContentType, DataItem } from './DataItem';

export class LRUCache {
  private capacity: number;
  private cache: Set<string>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Set<string>();
  }

  has(value: string): boolean {
    return this.cache.has(value);
  }

  access(value: string): void {
    if (this.cache.has(value)) {
      this.cache.delete(value);
    } else if (this.cache.size >= this.capacity) {
      const oldestValue = this.cache.values().next().value as string;
      this.cache.delete(oldestValue);
    }
    this.cache.add(value);
  }

  listAccess(list: string[]): void {
    list.forEach((value) => {
        this.access(value);
      
    });
  }

  dataItemListAccess(list: DataItem[]): void {
    list.forEach((item) => {
      if (item.type === DataContentType.COMMON) {
        this.access(item.id);
      }
    });
  }

  getSize(): number {
    return this.cache.size;
  }

  getCacheList(): string[] {
    return Array.from(this.cache);
  }
}
