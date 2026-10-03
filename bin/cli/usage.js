// The text of knayi --help and knayi --version. README.md, "Command line", says the same at more length.

import { VERSION, OUTPUT_VERSION } from '../../src/index.js';

export const USAGE = `Usage: knayi <command> [options] [file ...]

Reads each file in turn, or standard input when no file is given or the file
is -, and writes to standard output. Plain text is read and written line by
line; each line keeps its line break.

Commands:
  normalize   Unicode text in the storage order of UTN #11, with typing slips
              and look-alike digits fixed, in NFC
  to-unicode  Zawgyi or Win text in Unicode. Without --from, each line is
              detected, and a line that reads as Unicode stays as it is
  to-zawgyi   Unicode text in Zawgyi, each line on its own
  convert     to-unicode or to-zawgyi, as --to says
  detect      the encoding of each line: unicode, zawgyi, unknown (a tie) or
              none (no Myanmar letter)
  segment     the syllables of each line, with --separator between them
  check       each thing normalize would change, and each line in Zawgyi, as
              <file>:<line>:<column>: <rule>: <text> -> <fix>

Options:
  --from <encoding>      the encoding of the text: unicode, zawgyi or win for
                         to-unicode (default: detect each line); unicode or
                         zawgyi for to-zawgyi and segment (default: unicode)
  --to <encoding>        convert: unicode or zawgyi
  --tie <reading>        to-unicode: how a line whose evidence ties is read,
                         unicode (left as it is; the default) or zawgyi
  --detector <name>      to-unicode, detect, check: rules (the default) or
                         myanmar-tools, installed next to knayi-myscript
  --policy <policy>      segment: how a consonant with no mark is read:
                         separate (the default), a syllable of its own;
                         chains, joined to the syllable after it; pairs,
                         joined two by two, as 2.x syllBreak did
  --separator <text>     segment: what goes between syllables (default: |)
  --jsonl                read and write JSON Lines, one object per line; every
                         field but the one written is passed through as it was
  --field <name>         --jsonl: the field that holds the text (default: text)
  --into <name>          --jsonl: the field the result is written to (default:
                         --field for text; encoding, syllables or issues)
  --encoding <name>      the bytes of the input: utf-8 (the default) or
                         windows-1252; the output is always UTF-8
  --max-line-length <n>  the longest line read, in UTF-16 units (default:
                         16777216)
  --report               when done, write a JSON summary to standard error
  -h, --help             print this help
  -v, --version          print the version, and the output version

Exit status:
  0  done, and check found no issue
  1  check found an issue
  2  a usage error: an unknown command or option, a value the command does not
     take, or a detector that is not installed
  3  an input error: a file that cannot be read, bytes not valid in --encoding,
     a line over --max-line-length, or a JSON Lines line that is not an object
     with a string --field
  4  any other failure, such as an output that cannot be written
`;

// knayi --version: the package version, and OUTPUT_VERSION (decision 33), which a dataset can record.
export function versionText() {
  return 'knayi ' + VERSION + ' (output version ' + OUTPUT_VERSION + ')\n';
}
