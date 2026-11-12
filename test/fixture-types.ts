import type { CassetteEntry } from '../src/utils/http.js';
import type { ExtractionSnapshot } from '../src/utils/snapshot.js';

export interface PlatformItem {
  id: string;
  platform: string;
  category: string;
  url: string;
  description: string;
}

/** test/fixtures/<id>.json */
export interface PlatformFixture {
  id: string;
  platform: string;
  url: string;
  recorded_at: string;
  /** Every HTTP request made during the extraction, replayed offline */
  requests: CassetteEntry[];
  /** Expected extraction summary */
  expected: ExtractionSnapshot;
}
