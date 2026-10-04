'use strict';
// Prints the results of the shared call lists (scripts/browser/examples.js) in Node, from the ES module sources, as
// JSON on stdout: { compat, api }, the 2.x calls on compat (src/compat/index.js) and the 3.0 calls on the 3.0 API
// (src/index.js). The builds must give the same.
//
// The `adapter: 'myanmartools'` examples pass no detector, so they use the rule scorer here as they do in a browser:
// compat loads no package by name (2.11, 649b2b4). myanmar-tools stays hidden all the same, so that a compat that
// loaded it would differ. It runs in its own process because compat warns of the missing detector once per process.

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
