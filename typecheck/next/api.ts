// Compiles code against src/index.d.ts, the types of the 3.0 API (docs/next/DESIGN.md §11). Each @ts-expect-error
// line must be an error, so the types refuse what the functions refuse. Each part imports what it uses.

// The versions, traces and errors.
import { VERSION, OUTPUT_VERSION, createTrace } from '../../src/index.js';
import type { Trace, KnayiError } from '../../src/index.js';

const version: string = VERSION;
const outputVersion: number = OUTPUT_VERSION;
const trace: Trace = createTrace();
const lines: string[] = ['\u1031\u1000', '\u1000\u102C'];

// normalize and isNormalized: a string, or a report with { report: true }.
import { normalize, isNormalized } from '../../src/index.js';
import type { NormalizeOptions, NormalizeReport, NormalizeChange, NormalizeResult } from '../../src/index.js';

const normalized: string = normalize(lines[0]);
const mapped: string[] = lines.map(normalize); // the index is no options
const report: NormalizeReport = normalize(lines[0], { report: true });
const change: NormalizeChange | undefined = report.changes[0];
const stages: string[] = change ? change.rules : [];
const plain: string = normalize(lines[0], { report: false });
normalize(lines[0], { trace });
const checked: boolean = isNormalized(normalized);
// @ts-expect-error: text must be a string
normalize(42);
// @ts-expect-error: report is a boolean
normalize('x', { report: 'yes' });
// @ts-expect-error: a report is not a string
const notText: string = normalize('x', { report: true });
// Options built once and reused, or a flag that is a boolean, may ask for a report: the result is either.
const stored: NormalizeOptions = { report: true };
const either: string | NormalizeReport = normalize(lines[0], stored);
// @ts-expect-error: a stored NormalizeOptions may give a report
const storedText: string = normalize(lines[0], stored);
declare const wantReport: boolean;
// @ts-expect-error: a boolean flag may give a report
const flaggedText: string = normalize(lines[0], { report: wantReport });
const flagged: string | NormalizeReport = normalize(lines[0], { report: wantReport });
const nullFlag: string = normalize(lines[0], { report: null });
// @ts-expect-error: normalize takes no offsets, next to a key it takes too
normalize('x', { report: true, offsets: true });
// @ts-expect-error: options are an object, not a string
normalize('x', 'report');
try {
  normalize(lines[0]);
} catch (error) {
  const code: string = (error as KnayiError).code;
}

// detectEncoding, with and without a detector
import { detectEncoding } from '../../src/index.js';
import type { EncodingEvidence, ZawgyiDetector } from '../../src/index.js';

const detector: ZawgyiDetector = { getZawgyiProbability: (text: string) => text.length % 2 };
const evidence: EncodingEvidence = detectEncoding(lines[0]);
const byModel: EncodingEvidence = detectEncoding(lines[0], { zawgyiDetector: detector, thresholds: [0.1, 0.9] });
const encodings: string[] = lines.map(detectEncoding).map((found) => found.encoding);
const probability: number | undefined = byModel.zawgyiProbability;
// @ts-expect-error: the encodings are named
const notAnEncoding: EncodingEvidence = { encoding: 'en', unicode: 0, zawgyi: 0 };

// explain
import { explain } from '../../src/index.js';
import type { Issue, IssueKind } from '../../src/index.js';

const issues: Issue[] = explain(lines[0], { zawgyiDetector: detector });
const kinds: IssueKind[] = issues.map((issue) => issue.kind);
const fixes: string[] = issues.map((issue) => issue.fix);
// @ts-expect-error: explain takes no report
explain(lines[0], { report: true });
const unicodeIssues: Issue[] = explain(lines[0], { from: 'unicode' });
// @ts-expect-error: explain reads Unicode or Zawgyi, not Win
explain(lines[0], { from: 'win' });

// toUnicode: a string, or { text, offsets } with { offsets: true }; toZawgyi
import { toUnicode, toZawgyi } from '../../src/index.js';
import type { ConversionWithOffsets, ToUnicodeOptions, ToUnicodeResult } from '../../src/index.js';

const unicode: string = toUnicode(lines[0], { from: 'zawgyi' });
const detected: string[] = lines.map(toUnicode);
const tied: string = toUnicode(lines[0], { tie: 'zawgyi', zawgyiDetector: detector });
const withOffsets: ConversionWithOffsets = toUnicode(lines[0], { offsets: true });
const firstSource: number | undefined = withOffsets.offsets[0];
toUnicode(lines[0], { from: 'win', trace });
const noOffsets: string = toUnicode(lines[0], { from: 'zawgyi', offsets: false });
// A stored ToUnicodeOptions, or a boolean flag, may ask for offsets: the result is either.
const conversion: ToUnicodeOptions = { from: 'zawgyi', offsets: true };
const converted: ToUnicodeResult<ToUnicodeOptions> = toUnicode(lines[0], conversion);
// @ts-expect-error: a stored ToUnicodeOptions may give { text, offsets }, which has no length
toUnicode('x', conversion).length;
declare const wantOffsets: boolean;
// @ts-expect-error: a boolean flag may give { text, offsets }
const flaggedUnicode: string = toUnicode(lines[0], { offsets: wantOffsets });
const reportType: NormalizeResult<{ report: true }> = normalize(lines[0], { report: true });
// @ts-expect-error: toUnicode takes no to, next to a key it takes too
toUnicode('x', { from: 'zawgyi', to: 'unicode' });
// @ts-expect-error: options are an object, not a font name
toUnicode('x', 'zawgyi');
// @ts-expect-error: options are an object, not an array
toUnicode('x', ['zawgyi']);
declare const maybeOptions: ToUnicodeOptions | undefined;
const maybeConverted: string | ConversionWithOffsets = toUnicode(lines[0], maybeOptions);
// @ts-expect-error: from is a font name
toUnicode('x', { from: 'Zawgyi' });
// @ts-expect-error: tie is 'unicode' or 'zawgyi'
toUnicode('x', { tie: 'win' });
const zawgyi: string = toZawgyi(unicode, { trace });

// segmentSyllables and syllableBoundaries
import { segmentSyllables, syllableBoundaries } from '../../src/index.js';

const syllables: string[] = segmentSyllables(lines[0], { bareConsonants: 'pairs', from: 'zawgyi' });
const boundaries: number[] = syllableBoundaries(lines[0]);
const pieces: string[][] = lines.map(segmentSyllables);
// @ts-expect-error: the policies are separate, chains and pairs
segmentSyllables('x', { bareConsonants: 'words' });
// @ts-expect-error: segmentSyllables reads Unicode or Zawgyi, not Win
segmentSyllables('x', { from: 'win' });

// truncate and collapseRepeatedMarks
import { truncate, collapseRepeatedMarks } from '../../src/index.js';

const cut: string = truncate(lines[0], { length: 10, omission: '\u2026', bareConsonants: 'separate' });
const cutDefault: string = truncate(lines[0], { length: null, omission: null });
const collapsed: string = collapseRepeatedMarks(lines[0], { from: 'zawgyi' });
// @ts-expect-error: length is a number
truncate('x', { length: '30' });
