import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from './csv.js';

test('parseCsv reads quotes, commas and line breaks inside quotes, CRLF and skips blank lines', () => {
  const text = '﻿name,email\r\n"Rao, Aditya","a@x.com"\n\n"He said ""hi""",b@x.com\n"two\nlines",c@x.com';
  assert.deepEqual(parseCsv(text), [['name', 'email'], ['Rao, Aditya', 'a@x.com'], ['He said "hi"', 'b@x.com'], ['two\nlines', 'c@x.com']]);
  assert.deepEqual(parseCsv(''), []);
});

test('toCsv quotes everything, round-trips, and defuses spreadsheet formulas', () => {
  const rows = [['Name', 'Note'], ['Rao, "Adi"', 'line\nbreak'], ['=HYPERLINK("x")', null]];
  const out = toCsv(rows);
  assert.equal(out.split('\r\n')[2], `"'=HYPERLINK(""x"")",""`);
  assert.deepEqual(parseCsv(out), [['Name', 'Note'], ['Rao, "Adi"', 'line\nbreak'], [`'=HYPERLINK("x")`, '']]);
});
