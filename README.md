knayi
=====

support email:  support@kanyi.com
		beginofalove@hotmail.com

**Knayi** is Standalone Myanmar Languages JavaScript Library, which can use for building Myanmar **Unicode** standard web in user friendly.
Script include Font Detector, Font Converter, Syllable Break Points, Keyboards.

To Create knayi object, knayi accpet jQuery object, HTMLCollections or single html tag.

```knayi( [element collection], [font type {option,string}], [down to text nodes {option,true/false}] );```

* element collection: HTMLCollection or HTMLtag or jQuery object to work
* font type: When the font-type is already defined. 'unicode5' or 'zawgyi'
* down to text nodes: Use to convert complex tag like (body, html). font converter will look every single #text nodes separately

Example Selecting: ```var object = knayi( document.querySelectorAll("p.textContent") );```

### Font Detection {string or element}

Detect Zawgyi and Unicode 5 fonts in Burmese ('my') language. You can directly detect a string or you can also detect a html tag.
Just simply use ```knayi.fontDetect()```
```
// String can direct use to detect their font-type
var str = "{myanmar words}"
var result = kanyi.fontDetect( str );

/* Example returned result
 *  [ 
 *      { type: 'unicode5', matchTime: 10 },
 *      { type: 'zawgyi', matchTime: 2 }
 *  ]
 */

```
 * To detect font-type within elements just use

 ```knayi( $("nav[role='navbar']") ).fontDetect( [unstable{ture/false}] );```
 * {unstable} mean these element can be change font-type.By defining {unstable} = true, knayi will watch there elements changes and when they change they will automatically update their right font-type

```
// Select elements
var collection = document.querySelectorAll("p.myanmar");
var kny = knayi( collection ).fontDetect();

// Detecting base on elem or elements collections, results for each elements are recored as "knyData.fontType" in their element
// collection[1].knyData.fontType = "unicode5"

```

### Font Convention {string or element}
Converting font can also use to convert "string" directly or convert element's #text nodes.

Support type:

 * unicode5
 * zawgyi

``` knayi( [elements] ).fontConvert( [convert to {string}], [convert from {string}] ); ```

No need to worried about your position of text because knayi don't change element innerHTML. knayi use #text node to convert these tag.

To convert complex container tag which include both zawgyi or unicode5 standard strings, Give kanyi object "down to text node" true.

``` knayi( document.body, false , true).fontConvert("unicode5"); ```

Then Font Converter will looking every single #text node in "body" separately.

### Syllable Break Point Adding {string or element}

For Sting: ``` knayi.syllbreak( [string], [language{string}]) ```

For element: ``` knayi( [element] ).syllbreak( [langauge{string}] ) ```

* Support language
	- Burmese (my)
	- Rakhine (rki)
	- Tavoyan (tvn)
	- Intha (int)
	- Mon (mnw)
	- Sgaw Karen (ksw)
	- Shan (shn)
	- Khamti Shan  (kht)

Font Detection or Font Converting will remove breakpoints ```\u200B```


### Knayi Keyboard

Knayi Keyboard can work on input element or contenteditable element.

``` knayi.keyboard( [element{single element}, 'zawUnicode5'] ); ```

zawUnicode5 Keyboard is ```ေ``` first keyboard with same layout with **AphpaZawgyiUnicodeL** keyboard
