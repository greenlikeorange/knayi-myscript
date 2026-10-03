// Standard output for a run: written a chunk at a time, waiting while the pipe is full, so that a run holds about
// one chunk of output however large its input is.

import { CliError, EXIT } from './errors.js';

// { write(text), finish(), closed }. closed turns true when the reader of the pipe has gone (EPIPE, as when the
// output goes to `head`): the run then stops reading and ends quietly, as a Unix filter does. Any other write error
// makes the next write, or finish(), throw a FAILURE.
export function createOutput(stream) {
  const state = { closed: false, error: null };
  stream.on('error', (error) => {
    if (error && error.code === 'EPIPE') state.closed = true;
    else state.error = error;
  });
  return {
    get closed() {
      return state.closed;
    },
    async write(text) {
      throwIfFailed(state);
      if (state.closed || text === '') return;
      if (!stream.write(text)) await drained(stream);
      throwIfFailed(state);
    },
    async finish() {
      throwIfFailed(state);
    }
  };
}

function throwIfFailed(state) {
  if (state.error !== null) throw new CliError(EXIT.FAILURE, 'cannot write the output: ' + state.error.message);
}

// Resolves when the stream can take more, or has closed or failed (the 'error' listener above records why).
function drained(stream) {
  return new Promise((resolve) => {
    const done = () => {
      stream.off('drain', done);
      stream.off('close', done);
      stream.off('error', done);
      resolve();
    };
    stream.on('drain', done);
    stream.on('close', done);
    stream.on('error', done);
  });
}
