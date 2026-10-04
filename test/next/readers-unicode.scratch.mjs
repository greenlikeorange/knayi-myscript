// The scratch memory of the Unicode reader after long calls (docs/next/DESIGN.md §3.11, §6.4), in a process of its
// own: readers-unicode.test.mjs runs this file and reads what it prints. A call keeps a buffer of up to 65,536 units,
// so only a reader that no earlier call has used must be back at its first sizes.

import { reorderUnicode, unicodeReaderScratchUnits } from '../../src/engine/unicodeReader.js';
import { SyllableBuffer, CodeBuffer } from '../../src/engine/syllable.js';

const KA = String.fromCharCode(0x1000);
const VIRAMA = String.fromCharCode(0x1039);
const E = String.fromCharCode(0x1031);
const AA = String.fromCharCode(0x102C);

const firstSizes = new SyllableBuffer().capacity() + new CodeBuffer().capacity();
const report = () => (unicodeReaderScratchUnits() === firstSizes ? 'first sizes' : unicodeReaderScratchUnits());

// Each part grows one buffer far past 65,536 units: held spaces (and the syllable written with them), a stack, and
// a run of e waiting for its base.
const text = KA + ' '.repeat(3000000) + 'x' + KA + (VIRAMA + KA).repeat(1500000) + 'x' + E.repeat(2900000) + KA;
if (text.length <= 8900000) throw new Error('the long text is ' + text.length + ' units');
reorderUnicode(text);
const afterLong = report();
reorderUnicode((KA + AA + ' ').repeat(100000));
const afterLines = report();

process.stdout.write(JSON.stringify({ afterLong, afterLines }));
