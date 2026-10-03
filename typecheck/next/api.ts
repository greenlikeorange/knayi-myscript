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
