# knayi-myscript

JavaScript library for Myanmar (Burmese) text stored as Unicode or Zawgyi. Version 2.9.0. MIT license.

It detects the encoding, converts between them, inserts syllable breaks, collapses repeated spelling marks, normalizes some Unicode typing errors, and truncates on those breaks. It does not segment dictionary words, translate, or tokenize for a language model.

Install it from npm. npm, Yarn, pnpm, and Bun all read that registry.

```bash
npm install knayi-myscript
yarn add knayi-myscript
pnpm add knayi-myscript
bun add knayi-myscript
```

Browser script, global name `knayi`:

```html
<script src="https://unpkg.com/knayi-myscript@2.9.0/dist/knayi-myscript.min.js"></script>
```

## Runtime

Node.js 22 or newer. Node 24 is the long-term support release used for development. Node 22 remains supported. Yarn 1 refuses to install when Node is older than 22. npm and pnpm warn and continue.

```javascript
const knayi = require('knayi-myscript')
```

```javascript
import knayi from 'knayi-myscript'
```

```typescript
import knayi from 'knayi-myscript'
```

TypeScript types are `index.d.ts`. Import the whole object. `import { fontConvert } from 'knayi-myscript'` is not a supported export.

In Node, `require` and `import` both load `main.js` and share `setGlobalOptions`. A bundler that follows the `module` field loads `dist/knayi-myscript.es.js` instead. That file is a second copy. If one part of an app uses `main.js` and another uses `dist/knayi-myscript.es.js`, silent mode and detector settings do not cross between them.

These paths load without an `exports` map:

- `knayi-myscript`
- `knayi-myscript/library/converter`
- `knayi-myscript/dist/knayi-myscript.min.js`
- `knayi-myscript/dist/knayi-myscript.es.js`

## Font names

`unicode`, `uni`, `zawgyi`, and `zaw`. `uni` is Unicode. `zaw` is Zawgyi. Any other string is an unknown font.

## Missing content

`null`, `undefined`, and `''` are missing content.

| Function | Missing content |
| --- | --- |
| `fontDetect` | The fallback, or `'en'` when the fallback is omitted. Warns unless silent. |
| `fontConvert`, `syllBreak`, `spellingFix`, `normalize` | `''`. Warns unless silent. |
| `truncate` | `''`. Warns unless silent. |

Text with no Myanmar letters (`U+1000`–`U+109F`) is returned unchanged by detect, convert, break, spelling fix, and normalize. `fontDetect` returns the fallback or `'en'`. `truncate` still appends the omission.

`setGlobalOptions({ silent_mode: true })` hides those warnings. The option applies to the copy of the library that received the call.

## fontDetect(content, fallbackFontType?, options?)

Returns `'unicode'`, `'zawgyi'`, or the fallback / `'en'`.

When the rule scores tie, including a single consonant such as `က`, the result is the fallback, or `'zawgyi'` if the fallback is omitted.

```javascript
knayi.fontDetect('မဂၤလာပါ') // 'zawgyi'
knayi.fontDetect('မင်္ဂလာပါ') // 'unicode'
knayi.fontDetect('ကျ') // 'unicode'
knayi.fontDetect('က') // 'zawgyi'
knayi.fontDetect('က', 'unicode') // 'unicode'
knayi.fontDetect(null) // 'en'
```

`options.adapter` chooses the detector for that call. `'rules'` is the built-in scorer and the default. `'myanmartools'` uses the `myanmar-tools` package. Install it only for that adapter:

```bash
npm install myanmar-tools
```

```javascript
knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' })
knayi.fontDetect('မင်္ဂလာပါ', null, {
  use_myanmartools: true,
  myanmartools_zg_threshold: [0.05, 0.95]
})
```

`use_myanmartools: true` selects the same adapter. A probability below the first threshold returns `'unicode'`. A probability above the second returns `'zawgyi'`. A probability between them returns the fallback. The default pair is `[0.05, 0.95]`. If the package is not installed, the call uses the rule scorer and warns once.

`setGlobalOptions({ detector: { use_myanmartools: true } })` changes the default. An explicit `adapter` on a later call wins. A later call that only sets `use_myanmartools` keeps a previously stored threshold.

On `က္က`, the rule scorer returns `'unicode'`. `myanmar-tools` can return `'zawgyi'` because its probability falls between the thresholds.

## fontConvert(content, targetFontType, originalFontType?)

Returns a string. `targetFontType` is required. When `originalFontType` is omitted, `fontDetect` chooses it.

When the two fonts differ, spelling fix runs on the source font first. When they are the same, the trimmed text is returned and spelling fix does not run.

```javascript
knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // 'မင်္ဂလာပါ'
knayi.fontConvert('မဂၤလာပါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.fontConvert('မြန်မာ', 'zawgyi', 'unicode') // 'ျမန္မာ'
knayi.fontConvert('ကျ', 'unicode') // 'ကျ'
knayi.fontConvert(' ကာာ ', 'unicode', 'unicode') // 'ကာာ'
knayi.fontConvert('မဂၤလာပါ', 'uni', 'zaw') // 'မင်္ဂလာပါ'
knayi.fontConvert(null, 'unicode') // ''
knayi.fontConvert('က') // 'က'  (no target font; warns)
```

`fontConvert.debugging(content, targetFontType, originalFontType)` returns `{ to, from, matched_patterns, steps }`. `steps` is an array of strings. The last step equals `fontConvert` for the same arguments. `matched_patterns` is an array of pattern source strings.

## syllBreak(content, fontType?, breakPoint?)

Returns one string. The default break character is `U+200B`. This is the current public break, not a split into `မ|င်္ဂ|လာ|ပါ`.

```javascript
knayi.syllBreak('မင်္ဂလာပါ', null, '$$') // 'မင်္ဂလာ$$ပါ'
knayi.syllBreak('မင်္ဂလာပါ') // 'မင်္ဂလာ' + '\u200b' + 'ပါ'
knayi.syllBreak('မြန်မာ', 'unicode', '|') // 'မြန်|မာ'
knayi.syllBreak('က္က', 'unicode', '|') // 'က္က'
knayi.syllBreak('က္က', 'zawgyi', '|') // 'က္|က'
knayi.syllBreak('က္က', 'uni', '|') // 'က္က'
knayi.syllBreak('ကက', 'unicode', '|') // 'ကက'
```

When `fontType` is omitted, detection runs first. Unknown font names throw.

## spellingFix(content, fontType?)

Collapses a mark repeated two or more times into one mark. It does not reorder marks.

```javascript
knayi.spellingFix('မင်္ဂလာာပါါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.spellingFix('ကိီ', 'unicode') // 'ကိီ'
knayi.spellingFix('\u1033\u1033', 'zawgyi') // '\u1033'
knayi.spellingFix('\u1033\u1033', 'zaw') // '\u1033'
```

## normalize(content)

Unicode only. Reorders marks in a cluster, applies a small set of typing fixes, and rewrites some `ဝ` / `၀` and `ရ` / `၇` pairs. It keeps surrounding spaces. It is not the same operation as `spellingFix`.

```javascript
knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်') // 'မြိုင်မြိုင်\nဆိုင်ဆိုင်'
knayi.normalize(' မိြုင် ') // ' မြိုင် '
knayi.normalize('ကိီ') // 'ကီ'
knayi.normalize('ဝ') // '၀'
knayi.normalize('ဦ') // 'ဦ'
```

## truncate(content, options?)

Cuts on the current syllable breaks, then on spaces inside a syllable that does not fit. Defaults are `length: 30` and `omission: '...'`. The omission is appended even when the text is shorter than `length`. `options.fontType` accepts the same font names. When omitted, detection runs.

```javascript
knayi.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...'
knayi.truncate('က') // 'က...'
knayi.truncate('') // '...'
knayi.truncate(null) // ''
```

## Build

`npm test` builds the browser and ESM files, runs the tests, and type-checks `typecheck/`. `npm run test:bun` runs the Bun checks. `npm run test:pack` packs the tarball, installs it with Bun, and converts the Zawgyi greeting through `require` and `import`. `npm run build` writes:

- `dist/knayi-myscript.mjs`
- `dist/knayi-myscript.es.js` (same bytes as the `.mjs` file)
- `dist/knayi-myscript.js`
- `dist/knayi-myscript.min.js`
