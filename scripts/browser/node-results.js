'use strict';
// Prints main.js's results for the shared call list (scripts/browser/examples.js) as JSON on stdout.
//
// myanmar-tools is hidden, so the `adapter: 'myanmartools'` examples use the rule scorer here as they do in a
// browser, and the results compare across environments. It runs in its own process because the detector loads
// the adapter once per copy of the library.

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

const knayi = require('../../main.js');
const { allCalls, runCalls } = require('./examples');

process.stdout.write(runCalls(knayi, allCalls()));
