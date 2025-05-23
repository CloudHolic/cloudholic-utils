export class ResizableCircularBuffer<T> {
  private buffer: (T | undefined)[];
  private capacity: number;
  private logicalCapacity: number = 0;
  private size: number = 0;
  private head: number = 0;
  private tail: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.logicalCapacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.size < this.logicalCapacity)
      this.size++;
    else
      this.head = (this.head + 1) % this.capacity;
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.size)
      return undefined;

    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  toArray(): T[] {
    const result: T[] = [];

    for (let i = 0; i < this.size; i++)
      result.push(this.buffer[(this.head + i) % this.capacity] as T);

    return result;
  }

  resize(newCapacity: number): void {
    if (newCapacity > this.capacity) {
      const newBuffer = new Array(newCapacity);

      for (let i = 0; i < this.size; i++) {
        const oldIndex = (this.head + i) % this.capacity;
        newBuffer[i] = this.buffer[oldIndex];
      }

      this.buffer = newBuffer;
      this.head = 0;
      this.tail = this.size;
      this.capacity = newCapacity;
    }

    if (newCapacity < this.size) {
      const dataLoss = this.size - newCapacity;
      this.head = (this.head +  dataLoss) % this.capacity;
      this.size = newCapacity;
    }

    this.logicalCapacity = newCapacity;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  length(): number {
    return this.size;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
