import {
  Classification,
  ClassificationFailedError,
  ClassificationInput,
  ClassifierUnavailableError,
  MentionClassifier,
} from './mention-classifier.js';

/**
 * In-memory fake for `MentionClassifier`. Immutable by construction: a test
 * scripts the `Classification` each input's `title` should produce up
 * front, rather than mutating the fake mid-test.
 *
 * `classify()` for a title with no scripted response throws
 * `ClassificationFailedError` — the same error the real classifier raises
 * when it cannot produce usable output, so a test that forgets to script a
 * title fails the same way an unclassifiable headline would in production.
 */
export class InMemoryMentionClassifier implements MentionClassifier {
  constructor(
    private readonly classificationsByTitle: ReadonlyMap<string, Classification> = new Map(),
    private readonly unavailable: ClassifierUnavailableError | null = null,
  ) {}

  async assertReady(): Promise<void> {
    if (this.unavailable) {
      throw this.unavailable;
    }
    return Promise.resolve();
  }

  async classify(input: ClassificationInput): Promise<Classification> {
    const scripted = this.classificationsByTitle.get(input.title);
    if (!scripted) {
      throw new ClassificationFailedError(
        `InMemoryMentionClassifier has no scripted classification for title "${input.title}"`,
      );
    }
    return Promise.resolve(scripted);
  }
}
