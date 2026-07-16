import { ReplaySubject } from 'rxjs';

/**
 * Keyed registry of ReplaySubjects backing SSE streams.
 *
 * ReplaySubject (not plain Subject) is load-bearing: clients that connect
 * after events were emitted — e.g. a page refresh mid-run — replay the
 * buffered history instead of joining a silent stream.
 */
export class SseRegistry<TEvent> {
  private readonly subjects = new Map<string, ReplaySubject<TEvent>>();

  constructor(private readonly bufferSize?: number) {}

  /** Get the subject for an id, creating it on first access. */
  get(id: string): ReplaySubject<TEvent> {
    let subject = this.subjects.get(id);
    if (!subject) {
      subject = new ReplaySubject<TEvent>(this.bufferSize);
      this.subjects.set(id, subject);
    }
    return subject;
  }

  has(id: string): boolean {
    return this.subjects.has(id);
  }

  /** Complete the stream and drop it from the registry. */
  complete(id: string): void {
    this.subjects.get(id)?.complete();
    this.subjects.delete(id);
  }

  delete(id: string): void {
    this.subjects.delete(id);
  }
}
