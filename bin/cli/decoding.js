// Decoding an input's bytes as they arrive, for lines.js.
//
// The decoder is strict: bytes that are not valid in --encoding stop the run, rather than becoming U+FFFD, since
// knayi's output is data and a lost character must not pass unseen. When that happens, the text before the bad
// bytes is still given, so that the lines before them are written whatever the size of the chunks (lines.js).

const EMPTY = new Uint8Array(0);

export class ChunkDecoder {
  constructor(encoding) {
    this.encoding = encoding;
    this.decoder = new TextDecoder(encoding, { fatal: true });
    // The bytes of a UTF-8 character that a chunk began and the next must end: the decoder holds them too.
    this.unfinished = EMPTY;
  }

  // { text, valid } for the next chunk, or with no chunk, for the end of the input: its text, or when it holds
  // bytes that are not valid, valid false and the text before them.
  decode(bytes) {
    try {
      if (bytes === undefined) return { text: this.decoder.decode(), valid: true };
      const text = this.decoder.decode(bytes, { stream: true });
      if (this.encoding === 'utf-8') this.unfinished = unfinishedUtf8(this.unfinished, bytes);
      return { text: text, valid: true };
    } catch (error) {
      if (error.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') throw error;
      return { text: bytes === undefined ? '' : this.textBeforeBadBytes(bytes), valid: false };
    }
  }

  // The chunk, after the bytes it finishes, decoded by a lenient decoder, which writes U+FFFD for bad bytes, up to
  // the first U+FFFD. A U+FFFD typed in the text before the bad bytes cuts the text there instead: the error then
  // names an earlier line, and nothing wrong is written.
  textBeforeBadBytes(bytes) {
    const joined = new Uint8Array(this.unfinished.length + bytes.length);
    joined.set(this.unfinished, 0);
    joined.set(bytes, this.unfinished.length);
    const text = new TextDecoder(this.encoding).decode(joined);
    const bad = text.indexOf(String.fromCharCode(0xFFFD));
    return bad === -1 ? '' : text.slice(0, bad);
  }
}

// The bytes at the end of what has arrived (the unfinished bytes before, then the chunk) that begin a UTF-8
// character not yet finished. A character is at most 4 bytes, so they lie in the last 3 bytes; and when the chunk
// has 3 bytes or more, in the chunk, since it finishes any character the bytes before it began.
function unfinishedUtf8(before, bytes) {
  let recent = bytes;
  if (bytes.length < 3) {
    recent = new Uint8Array(before.length + bytes.length);
    recent.set(before, 0);
    recent.set(bytes, before.length);
  }
  for (let back = 1; back <= 3 && back <= recent.length; back++) {
    const byte = recent[recent.length - back];
    if (byte < 0x80) return EMPTY; // ASCII: every character before it is finished
    if (byte >= 0xC0) return utf8Length(byte) > back ? recent.slice(recent.length - back) : EMPTY; // a lead byte
  }
  return EMPTY; // continuation bytes only: the decoder rejects them, or has finished their character
}

// How many bytes the UTF-8 character this lead byte begins has (RFC 3629 §3).
function utf8Length(lead) {
  if (lead >= 0xF0) return 4;
  return lead >= 0xE0 ? 3 : 2;
}
