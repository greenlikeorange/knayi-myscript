Knayi Myanmar Script
====================

**Knayi** is Standalone Myanmar Languages JavaScript Library, which can use for building Myanmar **Unicode** standard web in user friendly.
Script include Font Detector, Font Converter, Syllable Break Points.

Nodejs
======

```bash
npm install knayi-myscript
```

### Font Convert


aSync version
```js
var knayi = require("knayi-myscript");
//@param {fontname-to-convert} default: "unicode5";

knayi([String]).fontConvert([to], function(edited_content, old_content){
  console.log(edited_content);
  
  // this.syllbreak can use for add break point to edited content
  var edited = this.syllbreak();
  console.log(edited);
});

```

Sync version
```js
var knayi = require("knayi-myscript");
var edited = knayi([String]).fontConvertSync([to]);
```

FontType
```js
knayi([String]).getFontType();

```

Syllbreak
```js
// Direct syllbrak
knayi([String]).syllbreak([language]);
```