# Win fonts: research notes

Notes behind `fontConvert(text, 'unicode', 'win')`, from October 2026. They cover what the Win fonts are, how their encoding works, which existing conversion rules knayi may reuse, and what data exists to test against. Issue: [#25](https://github.com/greenlikeorange/knayi-myscript/issues/25).

## Summary

- "Win" means the Win Innwa family by WinMyanmar Systems, 1992–2005. These fonts draw Burmese glyphs on ASCII and Windows-1252 code points, so `jrefrm` shows as မြန်မာ.
- knayi converts Win to Unicode only, with its own direct rules: each Win glyph becomes Unicode characters, and each syllable is written in Unicode storage order. Nothing is converted into Win, and Zawgyi is not involved.
- No existing Win rule set can be copied into knayi under MIT: the good ones are LGPL, GPL, or unlicensed. knayi's table was read from the font itself instead.
- There is no public, hand-checked Win ↔ Unicode corpus. Small MIT-licensed pair sets exist. Real Win text exists in Myanmar laws, which Myanmar copyright law doesn't protect, and in other public PDFs.

## 1. The fonts

**Maker.** WIN Myanmar Systems (Zaw Htut), with Myanma Computer Company in Yangon ([vendor site mirror][wms], [Myanmars.NET][mnet]). The font's own name string reads "Win Innwa Myanmar Font-Version 4. 2004 May Release. Created by WinMyanmar Systems".

**Timeline** (vendor's account):
- **1992:** the first Windows font. Win Researcher followed in August 1992.
- **1993:** release 3 had 40+ fonts.
- **2005:** release 4 had 80+ fonts. The free Win Innwa is from 2004.
- **Later:** "Win Innwa 5" and WinUni Innwa are Unicode fonts, not this encoding.

**Family.** About 45 faces named after places: Win Innwa (with 70%–130% size cuts), Researcher, Kalaw, Mandalay, Pyay, Yangon, Haka, Pinya, and others.
- **Shared encoding:** ThanLwinSoft registers one converter for all the Innwa and Researcher name variants. A 2026 whole-book conversion found that WinResearcher, Win---Researcher2, WinHaka, WinPinya, WinKalaw, WinInnwa and WinInnwa070A share one encoding ([tipitaka-abhidhana report][abh]).
- **Unchecked faces:** Mandalay, Pyay and the ethnic-language faces were not checked one by one.

**Not Win, though often grouped with it:**
- **Wwin_Burmese** (Win Tun, 1993): 63 of 124 single-code mappings differ from Win Innwa. ဏ is `%`, ဉ is `^`, and `?`/`/` are swapped. NFLCIME calls this mapping "WinMyanmar".
- **Other ASCII families:** CE, Academy, Gandamar, MS-Heavy, Kingmyanmarsar, Metrix-1 and Kannaka share some letters but not the medial ra or the stacked consonants ([Burglish font map][burglish]).
- **Not ASCII:** Zawgyi, Myazedi and BIT use the Myanmar block.

**Use.**
- **Vendor claims:** about 90% of desktop typesetting was done in Win, and Win was given to every government department in 1994. These are promotional claims ([brochure][bro]).
- **Early web:** pages were written in Win.
- **Corpus:** a 2008 corpus of 2.1M sentences was normalised to Win Innwa ([Hla Hla Htay & Murthy 2008][htay]).
- **Crawl:** a 2015 crawler found Win Innwa on 2–7% of Burmese pages, depending on domain (Su Mon Khine & Yadana Thein, IJWSC 6(1), 2015).
- **Still in demand:** people still write Win → Unicode tools for PDFs and Office files in 2025–26.

**Font license.** Win Innwa is freeware, "Copyright 1992-2000 by Win Myanmar Systems Inc. All rights reserved" (text of the vendor's download page, quoted on [energylemon][energy]; the original page is offline). No license allows redistribution. The demo page should not ship a Win font. It can show Win input as plain text and the Unicode output in an OFL font such as Noto Sans Myanmar.

## 2. The encoding

**What the font maps.** The character map of Win Innwa 4 (`WININNWA.TTF`, May 2004, sha256 `3dadeb05…ea25683`) is a Unicode (3,1) map with 176 code points:
- **95** printable ASCII characters.
- **68** Latin-1 characters, A0–FF.
- **11** Windows-1252 extras at bytes 0x82–0x8B and 0x92.
- **2** aliases: μ U+03BC duplicates µ, and ‐ U+2010 duplicates the hyphen.

Unmapped: `­ ¯ ± · ¸ º È Ë Ì Î Ï Ò Ô Õ Ù Û Ý Þ ë ì î ï ò ô õ ù ý ÿ` and the other Windows-1252 bytes. Other Win faces add a few glyphs; for example, Þ is a dash in WinInnwa070A.

**Visual order.** Text is stored in the order the glyphs are drawn, like Zawgyi:
- `a` (ေ) and the medial ra glyphs come before the consonant.
- `s G S` (ျ ွ ှ) come after it.
- Kinzi `F` is typed after the consonant it sits on: `t*Fvdyf` = အင်္ဂလိပ်.
- Stacked consonants follow the base: `Ak'¨` = ဗုဒ္ဓ.
- Marks often come in drawing order, asat before the dot below: `ajumifh` = ကြောင့်.

**Variants and ligatures.** Many Win glyphs are different shapes of one Unicode character:
- **Medial ra:** six shapes: `j` and `M` (narrow and wide), `N` and `B` (cut for an upper vowel), `` ` `` and `~` (cut for a lower mark). `>` and `<` also draw ွ; `û` and `ê` also draw ု.
- **Long vowel signs:** `K L` (ု ူ).
- **Dot below:** `h U Y`.
- **Short letters:** `E` (န), `½` (ရ), `ñ` (ည).
- **Two widths:** ဉ (`Í Ú`), stacked ္တ (`Å å`) and stacked ္ထ (`¦ ¬`).
- **Kinzi with a vowel:** `Ø Ð ø`.
- **Medial combinations:** `Q R W T I ª`.
- **Consonant ligatures:** `@ | ¥ × ¹`, and `$` for ကျပ်.
- **Stacked consonants:** 25, in the Latin-1 range and at 0x92 (`’`, ္လ).

**No glyph of their own.** These letters are typed as look-alike sequences:

| Letter | Typed as |
| --- | --- |
| ဈ | `ps` |
| ဩ | `Mo` |
| ဪ | `aMomf` |
| ဦ | `OD` |
| ၎င်း | `¤if;` |

ဝ has no glyph either: `0` is both ဝ and ၀.

**Symbols.**
- **Fractions** ၁/၂ … ၄/၅ sit at bytes 0x83–0x8B. Unicode has no Burmese fractions.
- **Moved Latin punctuation:** `µ` is !, `¿` is ?, `ç` is a comma, `« »` are brackets, `] }` are curly quotes, `^` is a slash, `_` is ×.
- **Dingbats:** ☎ ♦ ✔ ♣ ✱ ♥ ➤ ✘ ♠ and a left arrowhead.
- **Vendor logo** at 0xB0.

**How Win text is stored.**
- **Word and Excel:** the Win runs carry a Win font name, which must be matched loosely ("Win Innwa", "WinInnwa", "Win---Innwa", "WinInnwa070A").
- **Plain text:** Windows-1252 files, and HTML keyed on the font name.
- **PDF text layers:** these keep the Win bytes but can split marks into separate spans or lose font names ([abhidhana report][abh]).
- **Mixed text:** once the font information is gone, Win text and English look the same.
- **Decoding:** a file read as ISO-8859-1 has C1 controls (U+0080–U+009F) where Windows-1252 has `’ ƒ „ …` and so on.

## 3. Existing converters and their licenses

knayi is MIT. A rule set can be ported only under a permissive license; copyleft or unlicensed code can at most be run as an outside reference at evaluation time.

| Converter | Directions | License | For knayi |
| --- | --- | --- | --- |
| [ThanLwinSoft](https://github.com/thanlwinsoft/myWebDevelopment) JS converter and `wininnwa.json`; [TECkit map](https://github.com/thanlwinsoft/DocCharConvert) (Keith Stribley, 2005–2010) | Win ↔ Unicode | LGPL-2.1+ | reference only; the best design: context rules, both directions, round-trip test |
| [python-myanmar](https://github.com/trhura/python-myanmar) | Win ↔ Unicode ↔ Zawgyi | MIT LICENSE, but its first commit's Win table equals ThanLwinSoft's (all 154 entries) and today's keeps 154 of 155 values | reference only |
| [kanaung/converter](https://github.com/kanaung/converter) (PHP) | Win → Unicode, Zawgyi, Ayar | MIT LICENSE (© 2013 kanaung) vs GPL-2.0+ header (© 2014 Sithu Thwin); rule files have no header | unclear; ask the author before any use. Sithu Thwin's later MIT [kanaung-converter](https://github.com/herzcthu/kanaung-converter) has no Win rules |
| [MCF NLP UniConversion](https://github.com/mcfnlp/UniConversion) (C#, 2008) and its port [saturngod/win2unicode](https://github.com/saturngod/win2unicode) | Win → Unicode | none | reference only |
| [NFLCIME](https://github.com/NFLC-UMD/NFLCIME) (University of Maryland) | Win → Unicode | LGPL-2.1 | reference only |
| Burglish / Prince Ka Naung (Ko Soe Min) | many fonts | GPL-2.0 in the source headers; WaitZar's copy ships GPL-3.0 | reference only |
| [WaitZar](https://github.com/minnkyaw/waitzar) `Uni2WinInnwa` (Seth Hetu, 2010) | Unicode → Zawgyi → Win | the wrapper is WaitZar's; the Zawgyi → Win step calls the bundled Burglish converter, GPL-3.0 | reference only |
| [my-winresearcher](https://github.com/mapmeld/my-winresearcher) (npm) | Win → Unicode | MIT | portable, but incomplete |
| ufc, mmtypebridge, wininnwa-to-unicode-converter, pndaza and others | various | none | reference only |

[Keyman's myWin Extended keyboard](https://github.com/keymanapp/keyboards/tree/master/release/sil/sil_myanmar_mywinext) has an MIT LICENSE (© SIL Global and Keith Stribley), though its source header still says LGPL. It is a Unicode keyboard that resembles the Win layout, not a converter. It agrees with the font on the base keys.

ICU/CLDR, Google's myanmar-tools, Rabbit and Parabaik have no Win support.

## 4. Data

| Source | What | License | Use |
| --- | --- | --- | --- |
| [ice-mdy-geo/ufc](https://github.com/ice-mdy-geo/ufc) unit tests (UCS Mandalay, 2018) | 32 Win → Unicode pairs: the UDHR's 30 articles, a pangram and the consonants; ~24 Unicode → Win pairs with other Win spellings | MIT | test data; the references have errors (below) |
| [python-myanmar](https://github.com/trhura/python-myanmar) `tests/data/uni2win-conversion.txt` | 15 word pairs | MIT | test data |
| [WaitZar](https://github.com/yathit/waitzar) `String Conversion Check.xls` | 2,404 Zawgyi / Win / Unicode word triples made by a converter | Apache-2.0 | silver data; has errors |
| Myanmar laws, [endomorphosis/ipfs_myanmar_laws](https://huggingface.co/datasets/endomorphosis/ipfs_myanmar_laws) | ~12–23 laws whose PDF text layer is Win, from moi.gov.mm; 3 also on Burmese Wikisource in Unicode | laws are not protected under Myanmar's 2019 Copyright Law, s.16 | real text; a hand-checked gold set could come from the 3 overlapping laws |
| World Bank Burmese documents, 2012–2017 | 9 PDFs with Win text layers | CC BY 3.0 IGO by default; check each | real text, unlabeled |
| [Judson Bible 1835](https://github.com/digitalbiblesociety/Archive-Bible-Burmese) | Unicode | Unlicense | source text to generate Win from |

There are no released Win datasets from papers. The 2008 corpus was never released.

**Results so far** (knayi `win-fonts` branch):
- **ufc Win → Unicode tests:** 130 of 134 lines match. In the other 4, the reference is wrong:
  - three write ၁ဝ, with wa, for the number 10;
  - one keeps the typed order of visarga and asat (လညး် for လည်း).
- **ufc Unicode → Win tests,** read the other way: 61 of 72 lines match. 9 of the other 11 are the test file's `#` layout lines. The last 2 are reference errors: လညး် again, and သဘာ၀ with a zero for သဘာဝ.
- **python-myanmar:** all 15 pairs match after NFC.
- **Against the Zawgyi route:** an earlier version of this branch converted through Zawgyi glyphs and knayi's Zawgyi rules. Its Unicode → Win direction was used to make Win text from 206,714 distinct words of Burmese Wikipedia and Okell's corpus.
  - **Same output:** the direct rules and that earlier version agree on 206,039 words.
  - **Where they differ:** the direct rules write Unicode storage order, and the earlier version kept the source text's order. For example, the direct rules write ယောက်ျား, as Google's myanmar-tools does, for the 174 words spelled ယောကျ်ား, and ဣန္ဒြေ for ဣနြ္ဒေ.
- **Larger samples:** these need Win text made by an outside converter at evaluation time, since knayi does not write Win (see the next steps).

## 5. knayi's design

**The glyph table.** `library/win.js` lists each code point Win Innwa 4 maps, the Unicode characters it stands for, and its role in a syllable:
- base: a consonant, independent vowel, digit or symbol;
- typed before the base: ေ and medial ra;
- mark: a medial, vowel sign or tone;
- stacked consonant;
- kinzi;
- plain text.

How it was made:
1. Every code point in the font's character map was rendered, and each glyph identified.
2. The starting guesses came from the Win keyboard layout and from the research summaries above. Those summaries draw on existing converter tables, ThanLwinSoft's LGPL table among them, and on the MIT myWin keyboard.
3. Every entry was then checked against the font's own glyph, side by side. That check corrected some guesses: `é` is stacked ္န and `Ñ` stacked ္ဈ.
4. No table, rule or code was copied from another converter.

`node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF` draws each Win glyph next to its Unicode text, for review.

**The rules.** knayi's own, written from Unicode's storage order (Unicode Technical Note #11). Since 2.10, Win and Zawgyi share them in `library/storageOrder.js`; [zawgyi-to-unicode.md](zawgyi-to-unicode.md) has the rules added for Zawgyi, which apply to Win too.
- **Sequences first:** `ps`, `Mo`, `aMomf` and `OD` become ဈ, ဩ, ဪ and ဦ.
- **Syllables:** a base starts a syllable. ေ and medial ra are typed before the base and belong to the next one; marks, stacked consonants and kinzi belong to the current one. A mark typed twice counts once.
- **Syllable order:** each syllable is written as kinzi, base, stacked consonant, then the marks in storage order: medials ျ ြ ွ ှ, ေ, upper vowels, lower vowels, ါ ာ, ံ, ့, ်, း.
- **Asat:** an asat that sits on the consonant is stored right after it, as in ယောက်ျား and ကျွန်ုပ်. It comes last after ာ, as in ကျော်.
- **Medial ra with a mark:** the four medial ra glyphs that also draw ွ or ု give both to the next base.
- **Zero:** `0` becomes ဝ unless it is part of a number.
- **Last step:** the result is NFC.

**Decisions.**
- **Name:** the font name is `win` ([#25](https://github.com/greenlikeorange/knayi-myscript/issues/25)).
- **Direction:** Win → Unicode only, the maintainer's decision. A Win target, or Win to Zawgyi, returns the text unchanged with an error, like an unknown font.
- **Direct rules:** an earlier version named Win glyphs by their Zawgyi code points and reused knayi's Zawgyi rules. At the maintainer's request it was replaced by the direct rules above.
- **No detection:** the source font must be named. Win text is ASCII, and `fontDetect` returns `'en'` for it.
- **Other functions:** only `fontConvert` reads Win. `syllBreak`, `truncate` and `spellingFix` return Win text unchanged, since it has no Myanmar letters; convert it first. Given the font name `win` and text with Myanmar letters, `syllBreak` and `truncate` throw a `TypeError` with the code `ERR_KNAYI_INVALID_FONT`, since their break rules are for Unicode and Zawgyi, and `spellingFix` collapses the Unicode marks.
- **Dropped:** the vendor logo is dropped.
- **Kept as typed:** `.` stays a period. Its glyph is a ring at the baseline, which could also be a dot below, but `.` is also the decimal point.

**Found along the way.** knayi read Zawgyi U+106F as ဎ္ဍ. Google's myanmar-tools, Rabbit's Zawgyi → Unicode, Pali spelling and the glyph all say ဍ္ဎ. This Zawgyi bug is fixed separately, with other Zawgyi ↔ Unicode fixes. Win's `¹` draws the same ligature; the direct rules read it as ဍ္ဎ.

## 6. Open questions and next steps

1. **Review the table.** A second reader of Burmese should check the review page. The least certain glyph is `É`, read as stacked ္တ with ွ.
2. **Look-alike digits:** since 2.10, `7` with a vowel sign or medial is read as ရ. `8` typed for ဂ stays a digit.
3. **Evaluation:** add Win to `scripts/eval`:
   - the ufc and python-myanmar pairs, pinned by sha256;
   - Win text made from the licensed Unicode corpora by an outside converter, converted back with knayi;
   - optionally, ThanLwinSoft's converter as an outside reference, run at evaluation time and never vendored.
4. **Gold set:** align the 3 laws that exist in both encodings by section and hand-check 300–500 sentences.
5. **Detection:** tell Win from English, for corpus cleaning. Possible approaches:
   - convert, then score how valid the Burmese is;
   - a character n-gram model trained on Win text generated from Unicode corpora.

   This fits the 3.0 data direction.
6. **Demo page:** add a Win input box with Unicode output. Don't ship a Win font.
7. **Wwin_Burmese:** could be a second ASCII mapping if anyone needs it.

[wms]: http://www.geocities.ws/Tokyo/Pagoda/8160/wms.htm
[bro]: http://www.geocities.ws/Tokyo/Pagoda/8160/wmsbro.pdf
[mnet]: https://myanmars.net/win-myanmar-systems/
[abh]: https://github.com/bthar-mx/tipitaka-abhidhana/blob/main/ocr/14b/extract-report.md
[burglish]: https://github.com/minnkyaw/waitzar/blob/master/win32_source/Contrib/Burglish/fontmap.cpp
[htay]: https://aclanthology.org/I08-7006/
[energy]: https://energylemon.weebly.com/win-myanmar-fontssystems.html
