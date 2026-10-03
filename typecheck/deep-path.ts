// The deep path README lists, knayi-myscript/library/converter, typed by library/converter.d.ts: the module is
// fontConvert. `import = require` compiles with and without esModuleInterop; typecheck/packed/ checks the default
// import, which needs esModuleInterop.
import fontConvert = require("knayi-myscript/library/converter");
import { fontConvert as packageFontConvert } from "knayi-myscript";
import type { ConvertDebug } from "knayi-myscript";

const converted: string = fontConvert("မဂၤလာပါ", "unicode", "zawgyi");
const debug: ConvertDebug = fontConvert.debugging("မဂၤလာပါ", "unicode", "zawgyi");
const same: typeof packageFontConvert = fontConvert;

// The types are index.d.ts's, not any.
// @ts-expect-error fontConvert returns a string
const wrong: number = fontConvert("မဂၤလာပါ", "unicode");

export { converted, debug, same, wrong };
