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
import type { NormalizeReport, NormalizeChange } from '../../src/index.js';

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

// toUnicode: a string, or { text, offsets } with { offsets: true }; toZawgyi
import { toUnicode, toZawgyi } from '../../src/index.js';
import type { ConversionWithOffsets } from '../../src/index.js';

const unicode: string = toUnicode(lines[0], { from: 'zawgyi' });
const detected: string[] = lines.map(toUnicode);
const tied: string = toUnicode(lines[0], { tie: 'zawgyi', zawgyiDetector: detector });
const withOffsets: ConversionWithOffsets = toUnicode(lines[0], { offsets: true });
const firstSource: number | undefined = withOffsets.offsets[0];
toUnicode(lines[0], { from: 'win', trace });
// @ts-expect-error: from is a font name
toUnicode('x', { from: 'Zawgyi' });
// @ts-expect-error: tie is 'unicode' or 'zawgyi'
toUnicode('x', { tie: 'win' });
const zawgyi: string = toZawgyi(unicode, { trace });
