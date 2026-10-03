# normalize: research notes

Notes behind knayi 2.10's `normalize`, from October 2026: what the 2.9 version did to correct text, what the new one does instead, and on what evidence.

## Summary

- 2.9's `normalize` changed half of the lines of clean, human-typed Unicode. It turned correct words and numbers into wrong ones, broke contractions, and wrote the dot below and asat in the opposite order to NFC.
- 2.10's `normalize` puts each syllable in Unicode storage order with the same rules as Zawgyi and Win conversion (`library/storageOrder.js`). It then makes a few typing fixes, shared with conversion (`library/typingFixes.js`), and returns NFC.
- On clean text it changes far less, and what it changes is meant: NFC order, Unicode Technical Note #11 order, typos and Zawgyi typing habits. Normalizing twice changes nothing more, and text from `fontConvert` comes back unchanged.

## 1. What 2.9 did to correct text

The test text is human-typed Unicode:
- FLORES-200 (CC BY-SA 4.0);
- a Burmese Wikipedia sample (CC BY-SA 3.0);
- John Okell's corpus (CC BY 4.0).

| | Distinct lines | Changed by 2.9 | Changed by 2.10 |
| --- | ---: | ---: | ---: |
| FLORES-200 | 2,009 | 1,614 | 177 |
| Wikipedia sample | 10,732 | 4,475 | 378 |
| Okell's corpus | 16,924 | 9,763 | 1,850 |
| Output not NFC | | 13,921 | 0 |
| Changed again by a second pass | | 0 | 0 |

What 2.9 got wrong:
- **Dot below and asat:** it sorted asat before the dot below (`့်`), the reverse of NFC, in 13,921 lines.
- **Contractions:** it always put asat after the vowels: ယောက်ျား became ယောကျာ်း, and ကျွန်ုပ် became ကျွနု်ပ်.
- **ဝ and ၀:** a lone ဝ became the digit, so words broke: လုံးဝ became လုံး၀, and ထာဝရ became ထာ၀၇.
- **ရ and ၇:** a ရ became ၇ whenever any digit appeared later in the line (ခံရသူ became ခံ၇သူ). A ၇ became ရ before a space (`၇ ရက်` became `ရ ရက်`). Years broke: ၁၉၇၇ became ၁၉ရရ.
- **Zero-width spaces:** removed.

## 2. Design

- **Syllables:** `arrangeUnicode` reads Unicode in its logical order. Kinzi (nga or ra, asat, virama) belongs to the consonant after it, virama plus consonant is a stacked consonant, and ေ and medial ra are marks like the others. Each syllable then goes through the same `order` as Zawgyi and Win: a mark typed twice counts once, asat goes where UTN #11 puts it, and the look-alike letters are fixed.
- **Typing fixes** (`typingFixes.js`): look-alike digits and letters, and a few misspellings. Zawgyi and Win conversion apply them too, so normalize leaves converted text as it is.
- **NFC first and last.** NFC can move a dot below in front of an asat or virama, which changes what they attach to, so the syllables are read from NFC text. Text with no character of the Myanmar blocks (U+1000–U+109F, U+A9E0–U+A9FF, U+AA60–U+AA7F) is returned after the first NFC, since the other steps would give it back as it is.

## 3. Decisions

**Unicode Technical Note #11 order**, as in Zawgyi conversion (`research/zawgyi-to-unicode.md`):
- an asat on a consonant comes before the medials (ခ်ျ), except after medial ha (ရှ်);
- with ု alone it comes before the vowel (ကျွန်ုပ်);
- typed after aa, it goes last (ကျော်).
2.10 adds one rule here: an asat typed after ေ goes last too. Otherwise a second pass would read `ခ်ေ` as a stray ေ.

**ai and anusvara** go after a lower vowel and aa, as UTN #11's constraints require; Burmese never combines them. Mon, Karen and Pa'o do (တုဲ, လှာဲ). With no lower vowel, either may also be typed before aa, to sit on the consonant (Karen ခရံာ်, Christ, 37 lines). It stays there, except anusvara before tall aa, which UTN #11 does not allow.

**ေ and medial ra typed before their consonant**, as people used to Zawgyi type them:
- They go to the consonant after them when they come after a space or punctuation, or after a syllable that already has its vowel or final. So လည်းေကာင်း becomes လည်းကောင်း, and မြင့်ြမတ် becomes မြင့်မြတ်.
- They stay where they are when nothing they could belong to follows (Okell's `ေ(ရ`), and right after a letter or mark of another language, such as a Mon medial (တၟေင်).
- An asat alone still takes a medial ra (ခ်ြ), and Mon's final h (`ှ်`) still takes ေ.

**Spaces and joiners.**
- **Space before a mark:** dropped, as in Zawgyi conversion (`သုံ း` becomes သုံး), but not after a digit. 781 lines of the test text have one, most of them in Okell's corpus.
- **Zero-width spaces, word joiners (U+2060) and zero-width no-break spaces (U+FEFF):** kept, and moved out of a syllable, as in Zawgyi conversion.
- **Zero-width joiners and non-joiners (U+200D, U+200C):** stay exactly where they are, since in Unicode text they can shape the syllable on purpose. A mark after one stays after it. Zawgyi and Win conversion move these two out of a syllable too.

**Look-alikes** change only in clear cases. The rest of 2.9's guesses are gone.
- **ဝ and ရ as digits:** only inside a number (၄ဝဝ, ၂၉,ဝ၂၈, ၂၀၁ရ). Not when glued to the word before the number, and ရ not when glued to the word after it (၂ရတယ်).
- **၀ and ၇ as letters:** when they carry a vowel sign or start a closed syllable (၀င်, ဆို၇င်), and ၀ also inside a word with no digit next to it (ဘ၀). A visarga after digits is a colon (၁၇း၂၁).
- **Shan, Mon and Karen marks** count as marks here too (issue #43): Shan ၀ႆ, ၀ႃ and ၀ႂ်, ၀ before a Shan consonant with asat (၀ၼ်း), and Karen သ၇ၣ် (teacher) and က၇ၢ. Their tone marks alone do not: S'gaw Karen text types the Shan tone-2 after numbers as a comma (၁၄း၁၅ႇ, in 6 lines of the sample). In the GlotCC text this changes only 15 S'gaw Karen lines, all of them ၇ typed for ရ.
- **A lone ဝ** stays a letter. It is a word (ဝ, fat) and ends words (လုံးဝ).

**ဥ and ဉ.** ဥ that takes asat, aa or a stacked consonant is ဉ, as UTN #11 says (ညဉ့်). The exception is right after a vowel sign, where Pa'o writes ဥ်း as a syllable. In the test text, Okell has ဥ with asat 65 times, all after a consonant (စဥ့်). Pa'o has it 22 times after a vowel sign and once after a consonant. FLORES and Wikipedia have none. Zawgyi conversion keeps converting it everywhere, since Zawgyi text is Burmese (ယာဥ္ is ယာဉ်).

## 4. Effect on Zawgyi and Win conversion

Sharing the typing fixes changes 226 of 9,987 real Zawgyi lines (mC4), all checked by hand:
- **Look-alike digits and letters:** 168 lines change only there, almost all with ဝ typed for zero in a number (၂ဝ၁၉ becomes ၂၀၁၉, and ၈ဝဝ, ၀၆း၃၀ and ၁၀ဘုရား).
- **ဦး:** 27 lines, typed with both ိ and ီ.
- **Doubled vowels:** ကြီး and အထူး.
- **Look-alike sevens:** ဆိုရင် and ၂၀၁၇.
- **The asat of ော်:** ကျော်.
- **Neutral:** a dozen lines of garbled text.

Win output is unchanged on the ufc and python-myanmar pairs. normalize still changes 22 converted Zawgyi lines, all with marks that belong to no syllable.

**One order for the typing fixes.** 2.10's conversion made them in the opposite order to `normalize`: look-alikes, then typos. Both now make the typos first, as `normalize` did. The order counts only where a typo fix and a look-alike read the same characters, as with a ရ before the digit ၄ of a lagaung:
- **Typos first:** the ၄ follows no digit, so it is ၎, and the ရ, next to no digit, stays ရ. Win `&4if;` is ရ၎င်း, as `normalize` makes ရ၄င်း and as Zawgyi `ရ၄င္း` already was, since Zawgyi's own sequence rule reads the ၄ before anything else.
- **Look-alikes first,** as 2.10's conversion did: the ရ next to the ၄ is ၇, and then the ၄ follows a digit and stays ၄. Win `&4if;` was ၇၄င်း, and so was Zawgyi typed with the visarga before the asat (`ရ၄ငး္`), which the sequence rule does not match.

`normalize`'s order was kept, rather than conversion's, because it reads ၄င်း after a letter as ၎င်း, as the typo rule means, and because it changes no `normalize` output. On every corpus of `npm run compare` (mC4's 14,304 distinct lines included, read as Zawgyi and with a detected font), and on its generated and random Win strings, it changes no converted line. In `fontConvert.debugging`, the two stages and the text between them come in the new order where both change a line: 1 mC4 line and 1 Shan line read as Zawgyi.

On the benchmark page, the Wikipedia round trip (Wikipedia → Rabbit's Zawgyi → knayi) falls from 99.1% to 96.6%. That row counts a line as right only when it comes back exactly as Wikipedia has it, and 120 lines of the Wikipedia text have typing errors that knayi now corrects. 118 have ဝ or ရ typed in a number (၁ဝ ရက်, ၁၂:၃ဝ, ၁၉ရ၂), and 2 have ိ and ီ together.

## 5. Other languages

`normalize` is written for Burmese, but other languages share the script. Lines of GlotCC text (CC0) changed:

| | Lines | 2.9 | 2.10 |
| --- | ---: | ---: | ---: |
| Shan | 9,923 | 5,750 | 266 |
| Mon | 2,270 | 715 | 119 |
| S'gaw Karen | 673 | 376 | 196 |
| Pa'o | 770 | 142 | 17 |

Letters and marks the Burmese rules do not know end a syllable and stay where they are. What still changes is mostly:
- NFC, and UTN #11 order;
- ဝ typed in numbers, and ၀ or ၇ typed in words (Karen သရၣ်);
- the Burmese look-alike fixes: Mon ဝဥ္ဇ becomes ဝဉ္ဇ, and Pa'o စျ becomes ဈ, which may not be right in Pa'o.

## 6. Speed

- **Real text:** 4.6 million characters of Wikipedia and Okell text take about 550 ms (2.9: about 830 ms). Zawgyi conversion with the shared typing fixes is as fast as before them.
- **Text with no Myanmar character** gets only the first NFC. On 4.5 million characters of English, that takes about a fiftieth of the time all the steps took as one string, and a twelfth a line at a time, under Node.
- **Worst cases stay linear:** a million marks on one consonant, a million ေ with or without consonants, and a million wa, digits, stacked consonants or kinzi each take about 200 ms or less. So does a run of marks of two classes, such as dot below and virama repeated, which NFC has to put in order: the runtime's `String.prototype.normalize` does that in quadratic time (32,000 pairs took about 1 s, 64,000 about 4 s), so `library/nfc.js` puts a long run in order first, and a million characters of it take about 70 ms.

## 7. Open questions

1. **Okell's corpus** uses ြ as a quotation mark (`ဘူးြ ဆို`), and dots below with spaces between as an ellipsis (` ့ ့ ့`). normalize reads them as a medial and a mark of the word before, as 2.9 did.
2. **Asat on a stacked consonant** is dropped as a slip, which is right for Burmese. In Mon it may be meant (2 lines of the sample).
3. **ချ် and ခ်ျ:** see `research/zawgyi-to-unicode.md`.
