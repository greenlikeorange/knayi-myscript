import knayi from "../dist/knayi-myscript.mjs";
import assert from "node:assert/strict";

const converted = knayi.fontConvert("မဂၤလာပါ", "unicode", "zawgyi");
assert.equal(converted, "မင်္ဂလာပါ");
console.log("bun esm contract ok", knayi.version);
