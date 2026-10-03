# Zawgyi to Unicode: research notes

Notes behind knayi 2.10's Zawgyi → Unicode rules, from October 2026: why the 2.9 rules were replaced, what the new rules decide and on what evidence, and how the result was checked.

## Summary

- The 2.9 rules were a chain of regular expressions. Compared with Google's myanmar-tools and Rabbit on real Zawgyi web text, they had a dozen kinds of bugs, most of them in the order of the marks.
- 2.10 converts Zawgyi like Win: each glyph becomes Unicode characters with a role in its syllable, and each syllable is written in Unicode storage order. Win and Zawgyi share that code (`library/storageOrder.js`). Unicode → Zawgyi keeps its pattern rules.
- Where myanmar-tools, Unicode Technical Note #11 and human-typed Unicode disagree, the notes below give the counts behind each choice.

## 1. Bugs in the 2.9 rules

Lines of real Zawgyi text with each bug in knayi's output. The text is the mC4 Burmese validation set (ODC-BY): 9,987 distinct lines that myanmar-tools scores as Zawgyi with p ≥ 0.95.

| | Bug | Example (output) | 2.9 | 2.10 |
| --- | --- | --- | ---: | ---: |
| A | စ with medial ya kept for ဈ | စျေး → ဈေး | 200 | 0 |
| J | Asat typed with ိ or ို kept | နို်င်ငံ → နိုင်ငံ | 99 | 0 |
| E | A mark twice in a row | အမှိုုက် → အမှိုက် | 91 | 7 |
| I | Asat typed after ု kept after it | ကျွနု်ပ် → ကျွန်ုပ် | 90 | 0 |
| F | Visarga typed before asat kept before it | ကောငး် → ကောင်း | 79 | 0 |
| B | The digit ၄ typed for ၎ | ၄င်း → ၎င်း | 44 | 0 |
| L | Dot below typed before anusvara kept before it | ဖွ့ံ → ဖွံ့ | 39 | 0 |
| C | ဥ kept where it stands for ဉ | ပဥ္စ → ပဉ္စ | 27 | 0 |
| G | Kinzi moved into the syllable before | ယေင်္ာကျား → ယောင်္ကျား | 21 | 0 |
| H | Medial ra put before a stacked consonant | အိနြ္ဒာ → အိန္ဒြာ | 21 | 0 |
| D | U+1096 (stacked ta with wa) left in the output | ပန႖ → ပန္တွ | 4 | 0 |
| K | A zero after a decimal point read as ဝ | ၅.ဝ → ၅.၀ | rare | 0 |

The 7 lines left under E are typing mistakes with no single right reading, such as a second ေ typed after a syllable.

## 2. Design

- **Glyph table** (`library/zawgyi.js`): each Zawgyi code point, the Unicode characters it stands for, and its role: base, typed before the base (ေ, medial ra), mark, stacked consonant, kinzi, or text. The entries follow knayi's 2.9 rules, corrected where those were wrong (U+1069 is stacked ဈ, and U+1096 had no rule), and were checked against the glyphs of the Zawgyi font the demo site ships (`docs/fonts/zawgyi.ttf`). Consonants and independent vowels keep their code points.
- **Sequences first:** lagaung typed as the digit ၄ before င္း, or as the ၎ glyph followed by the င္း it already draws, becomes the lagaung glyph.
- **Syllables** (`library/storageOrder.js`, shared with Win): a base starts a syllable. Glyphs typed before the base belong to the next one, and marks, stacked consonants and kinzi to the current one. Each syllable is written in Unicode storage order, then zero is read as ဝ where it is not part of a number, and the result is NFC.

## 3. Decisions

Counts of human-typed Unicode are from FLORES-200 (CC BY-SA 4.0), a Burmese Wikipedia sample (CC BY-SA 3.0) and John Okell's corpus (CC BY 4.0), in that order.

**Asat on a consonant with a medial and no vowel** (loanword finals such as -ch in ပေ့ချ်, message):
- UTN #11 has one slot for an asat that sits on a consonant, right after the consonant and any stacked consonant, before the medials. Its other asat slots follow ာ/ါ, a dot below, or medial ha. myanmar-tools writes this order: ခ်ျ.
- People type the medial first: ချ် 18, 25, 39 times; ခ်ျ 0, 7, 7.
- knayi 2.10 follows UTN #11 and writes ခ်ျ, the maintainer's choice. This is the main reason fewer FLORES sentences survive a round trip through Zawgyi (section 4).

**Asat with medial ha:** UTN #11 puts it after the medial (ရှ်), and so does human typing: 16, 39, 9 times, and never ရ်ှ. myanmar-tools writes ရ်ှ; knayi writes ရှ်.

**Asat with ု and no other vowel** (ကျွန်ုပ်): stored right after the consonant, as UTN #11 requires, whatever order it was typed in. Human typing agrees: န်ု 50, 25, 109 times; နု် 1, 0, 48.

**Asat typed before ာ:** in a contraction with a medial it stays on the consonant (ယောက်ျား). With no medial, it is the asat of the vowel typed early, and goes last: ေက္ာဖီ is ကော်ဖီ, not က်ောဖီ.

**Asat dropped:** no syllable has ိ or ီ with asat, and a stacked consonant takes no asat. In real text such an asat is a slip, typed early for the next consonant: နို္င္ (63 lines), အိ္မ္, လိ္ု႔, ကုလသမဂၢ္, ဓမၼ္တာ. myanmar-tools drops it in some cases (နိုင်) and keeps it in others (အ်ိမ်, လိ်ု့, ကုလသမဂ်္ဂ).

**A space typed before a dot below** (`ၿမိဳ ့`) is dropped, as in 2.9. In mC4 it comes before a letter 381 times and before a second space 140 times. Moving it after the dot, as myanmar-tools does, splits words such as မြို့နယ် and အောက်မေ့မိပါတယ်, and doubles the second space. A space typed before any other mark (`တစ္ခ ု`) only moved the mark and is dropped too, as myanmar-tools does. A line break is never dropped.

**Zero-width spaces and non-joiners** are kept from 2.10 on; 2.9 removed them. They appear in 113 of the 9,987 lines, mostly between words. Some tools type one after every asat, inside a syllable (`က်င္​း`, 187 times); it moves to the end of the syllable (ကျင်း​). myanmar-tools drops some of these and moves others, and drops the space after some of them.

**Letters Zawgyi draws alike:**
- စ with medial ya is ဈ, also stacked (မဇ္ဈိမ). U+1069 is stacked ဈ, not stacked စ with medial ya.
- ဥ with a stacked consonant, asat or ာ is ဉ: ပဉ္စ, ညဉ့်, ဉာဏ်. Human typing has ဉာ 20, 73, 201 times and ဥာ never. Okell's corpus has ဥ့် 65 times, the other two ဉ့်.
- ၄ before င္း is ၎ (၎င်း), unless a digit comes before it. The ၎ glyph followed by င္း is one ၎င်း; myanmar-tools and 2.9 doubled it (၎င်းင်း, 8 lines).
- ၇ with a vowel sign or medial is ရ: ေ၇း is ရေး. A visarga alone after digits is a colon in a time (၁၇း၂၁).

## 4. Results

**Reference pairs and round trip** (`npm run bench:page`):

| Data | n | 2.9.1 | 2.10 | myanmar-tools 1.1.3 |
| --- | ---: | ---: | ---: | ---: |
| google/language-resources pairs, exact | 80 | 81.3% | 100.0% | 97.5% |
| CLDR pairs not in Google's file, exact | 11 | 36.4% | 72.7% | 100.0% |
| Wikipedia → Rabbit Zawgyi → back | 4,745 | 95.1% | 99.1% | 96.9% |

The three CLDR pairs 2.10 misses expect ICU's output: the asat of ါ် before the ါ (ဒ်ါ), and a space moved after a dot below in two compound words (မြို့ နယ်, အဖွဲ့ အစည်း).

**mC4 web text**, compared line by line with myanmar-tools:
- **Agreement:** the same output after NFC on 85.5% of the 9,987 lines, up from 81.9%.
- **Lines that changed:** 966. 483 of them now agree with myanmar-tools.
- **Lines that newly differ:** 131, checked by hand. 115 follow the decisions above: ၎ (27), ၎င်း no longer doubled (6), ဉ (29), dropped slips (18), the asat of ော် (7), ၇ as ရ (9), and others. The other 16 are garbled or mistyped text, 12 of them one text with Cham letters in it.
- **Most of the remaining differences:** myanmar-tools leaves a zero typed for ဝ as a digit (ဘ၀, ၀င်).

**FLORES round trip**, Unicode → Zawgyi → Unicode with knayi: 1,934 of 2,009 sentences come back unchanged (2.9: 1,990). 6 sentences now come back unchanged and 65 no longer do:
- 29 spell ဈ as စျ, and come back as ဈ;
- 26 have a medial before the asat (ချ်, ဂျ်), and come back in UTN #11 order;
- 3 have ၄င်း, and come back as ၎င်း;
- 7 are FLORES typos that come back corrected.

**Stacked ဈ from Unicode** (refactor plan PR 4.8, after 2.10.0). Unicode → Zawgyi wrote U+1069, Zawgyi's stacked ဈ, for stacked စ with medial ya (`္စျ`), but had no rule for stacked ဈ itself (`္ဈ`, as in မဇ္ဈိမ). Its virama stayed U+1039, which Zawgyi reads as an asat, so မဇ္ဈိမ came back from Zawgyi as မဇ်ဈိမ. A rule next to the one for `္စျ` now writes U+1069 for `္ဈ` too; like the other stacked-consonant rules, it runs before the rule that writes the asat as U+1039. myanmar-tools 1.1.3 and Rabbit write U+1069 for stacked ဈ in every one of the 36 Unicode lines and pairs below that have it, and one of the three Zawgyi spellings of မဇ္ဈိမ in Google's pairs is U+1069. Round trip, Unicode → Zawgyi → Unicode with knayi, on distinct lines:

| Data | Lines | With `္ဈ` | Now come back as `normalize` writes them | Now come back exactly |
| --- | ---: | ---: | ---: | ---: |
| FLORES | 2,009 | 0 | 0 | 0 |
| Wikipedia, current sample | 4,812 | 8 | 8 | 8 |
| Wikipedia, first sample | 10,732 | 12 | 12 | 9 |
| Okell | 16,924 | 13 | 12 | 8 |
| google/language-resources pairs | 80 | 3 | 3 | 3 |

None of these lines came back before. Where a line still differs, the difference is elsewhere: a medial ra written after spaces (the Okell line), a zero typed for ဝ, a no-break space before a virama. A script, not a person, checked every string whose Zawgyi output changed (the counts are in CHANGELOG.md): each output is the old one with U+1039 U+1008 written as U+1069, and each input has a virama before ဈ. In 10 of the 14 mC4 lines that change, the text is Zawgyi read as Unicode, with ေ typed between the asat and ဈ.

**Win**, converted with the shared rules:
- **Reference pairs:** the ufc and python-myanmar pairs give the same output as before.
- **Corpus words:** Win text made from 206,714 corpus words converts the same for 206,156. 103 more words now come back as the original.

**Speed:** about 3 million characters of mC4 text convert in about 300 ms, the same as 2.9. The long inputs that were slow in 2.8 take 2 ms or less.

## 5. Open questions

1. **ချ် or ခ်ျ:** people type ချ်; UTN #11 and myanmar-tools write ခ်ျ. knayi 2.10 writes ခ်ျ, and `knayi.normalize` now puts Unicode text in the same order (`research/normalize.md`).
2. **Unicode → Zawgyi, ha under medial ra:** knayi writes the full ha (ျမွင့္), Rabbit the short one (ျမႇင့္). Real Zawgyi text has both: 128 and 84 times in mC4.
3. **Look-alike digit ၈** typed for ဂ stays a digit.
4. **Mixed text:** lines that mix Zawgyi with Unicode or other scripts cannot be read well by any converter.
