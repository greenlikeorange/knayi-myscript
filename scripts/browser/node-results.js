'use strict';
// Prints the results of the shared call lists (scripts/browser/examples.js) in Node, from the ES module sources, as
// JSON on stdout: { compat, api }, the 2.x calls on compat (src/compat/index.js) and the 3.0 calls on the 3.0 API
// (src/index.js). The builds must give the same.
//
// myanmar-tools is hidden, so the `adapter: 'myanmartools'` examples use the rule scorer here as they do in a
// browser, and the results compare across environments. It runs in its own process because compat loads the
// adapter once per process.

const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request) {
  if (request === 'myanmar-tools' || request.indexOf('myanmar-tools/') === 0) {
    const error = new Error("Cannot find module '" + request + "'");
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }
  return resolve.apply(this, arguments);
};

const compat = require('../../src/compat/index.js').default;
const api = require('../../src/index.js');
const { allCalls, apiCalls, runCalls } = require('./examples');

process.stdout.write('{"compat":' + runCalls(compat, allCalls()) + ',"api":' + runCalls(api, apiCalls()) + '}');
