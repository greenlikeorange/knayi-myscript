Knayi Myanmar Script
====================

Standalone Myanmar languages JavaScript library, use to build Myanmar **Unicode** standard web easily.

Include
 - Unicode/Zawgyi Detector
 - Unicode/Zawgyi Converter
 - SyallBreak for Unicode/Zawgyi
 - Spelling Check for Unicode/Zawgyi

### Install
```bash
npm install knayi-myscript
```

### Usage

**fontDetect(content, [defaultFont])**

Font Detector, it will detect unicode/zawgyi of the **content** Text.  
If nothing is matched or possibility are equal, it will return as 'zawgyi' or specified font type in **defaultFont** params.  

```
knayi.fontDetect('မဂၤလာပါ') // zawgyi
knayi.fontDetect('မင်္ဂလာပါ') // unicode
```

**fontConvert(content, convertTo, [convertFrom])**

Converting font to target font type. This method need spelling fix, so it gonna use **spellingFix** in default.  
**convertFrom** will be detect by **fontDetect** when you don't described.

```
knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // မင်္ဂလာပါ
knayi.fontConvert('မဂၤလာပါ', 'unicode') // မင်္ဂလာပါ
```

**syllBreak(content, [fontType] [,breakPoint])**

To make systematic word break of Myanmar text.  
**convertFrom** will be detect by **fontDetect** when you don't described.

```
knayi.syllBreak('မင်္ဂလာပါ', null, '$$') // 'မင်္ဂ$$လာ$$ပါ'
```

**spellingFix(content, [fontType])**  
**convertFrom** will be detect by **fontDetect** when you don't described.

It fix spelling on Myanmar Text

```
knayi.spellingFix('မင်္ဂလာာပါါ') // 'မင်္ဂလာပါ'
```
