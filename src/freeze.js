// Frozen data for src/ (DESIGN.md §2.4, D16). Layer L0: imports nothing.
//
// Every exported table, row list and option set is frozen through deepFreeze, and every top-level call of it
// carries /* @__PURE__ */, so that a bundle which never reads the value drops it (esbuild keeps a bare
// Object.freeze call, and any call it cannot see is free of side effects).

// Object.freeze on value and, recursively, on every plain object and array it holds. Returns value.
//
// - RegExps and typed arrays are left as they are. A frozen RegExp has a read-only lastIndex, so replace,
//   search, match and test throw a TypeError on it, and a typed array that has elements cannot be frozen.
//   Both are read-only by contract: nothing outside their module writes them.
// - Functions, such as a stage's run, are left as they are; the object holding them is frozen.
// - A value that is already frozen is taken as frozen all the way down, so a cycle (compat's default export
//   points back at its own object) ends there.
export function deepFreeze(value) {
  if (!isPlainContainer(value) || Object.isFrozen(value)) return value;
  Object.freeze(value);
  const names = Object.getOwnPropertyNames(value);
  for (let i = 0; i < names.length; i++) {
    deepFreeze(value[names[i]]);
  }
  return value;
}

// An array, or an object made by a literal or with a null prototype.
function isPlainContainer(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
