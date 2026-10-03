// Writing one field into the source text of a JSON Lines record (bin/cli/records.js withField): the rest of the line
// stays byte for byte as it was, so values JSON.parse would change (an id of 20 digits, 1.50, an escaped character)
// pass through.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withField } from '../../../bin/cli/records.js';

describe('withField', () => {
  it('replaces the value of the member, whatever it held, and nothing else', () => {
    assert.equal(withField('{"id":12345678901234567890,"text":"a","n":1.50}', 'text', 'b'),
      '{"id":12345678901234567890,"text":"b","n":1.50}');
    assert.equal(withField('{"text":{"a":["}",{"b":"\\"]"}]},"x":1}', 'text', 'b'), '{"text":"b","x":1}');
    assert.equal(withField('{"text":null}', 'text', ['a', 'b']), '{"text":["a","b"]}');
    assert.equal(withField('{"text":-1.5e3 ,"x":true}', 'text', 'b'), '{"text":"b" ,"x":true}');
  });

  it('reads member names as JSON does: escapes decoded, the last of two equal names replaced', () => {
    assert.equal(withField('{"t\\u0065xt":"a"}', 'text', 'b'), '{"t\\u0065xt":"b"}');
    assert.equal(withField('{"text":"a","text":"c"}', 'text', 'b'), '{"text":"a","text":"b"}');
    assert.equal(withField('{"a\\"text":"a","text":"c"}', 'text', 'b'), '{"a\\"text":"a","text":"b"}');
  });

  it('keeps white space of every kind JSON allows, a carriage return at the end included', () => {
    assert.equal(withField(' {\t"text" :\t"a" , "x" : 1 }\r', 'text', 'b'), ' {\t"text" :\t"b" , "x" : 1 }\r');
  });

  it('adds a missing member at the end, spaced as the first member is', () => {
    assert.equal(withField('{"text":"a"}', 'encoding', 'unicode'), '{"text":"a","encoding":"unicode"}');
    assert.equal(withField('{"text": "a", "n": 1}', 'encoding', 'unicode'),
      '{"text": "a", "n": 1, "encoding": "unicode"}');
    assert.equal(withField('{}', 'encoding', 'none'), '{"encoding":"none"}');
    assert.equal(withField('{ } ', 'issues', []), '{ "issues":[]} ');
  });

  it('writes the value as JSON.stringify does: escapes for quotes, controls and lone surrogates', () => {
    assert.equal(withField('{"text":"a"}', 'text', '"\n\uD800'), '{"text":"\\"\\n\\ud800"}');
  });
});
