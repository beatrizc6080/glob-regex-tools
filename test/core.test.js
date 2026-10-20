import { test } from "node:test";
import assert from "node:assert/strict";

import { globToRegex } from "../src/index.js";

/**
 * Helper: assert that a glob matches a full string.
 * @param {string} glob
 * @param {string} input
 * @param {object} [options]
 */
function matches(glob, input, options) {
  return globToRegex(glob, options).test(input);
}

test("literal pattern matches only itself", () => {
  assert.equal(matches("foo.txt", "foo.txt"), true);
  assert.equal(matches("foo.txt", "fooxtxt"), false);
  assert.equal(matches("foo.txt", "xfoo.txt"), false);
});

test("single star matches within a path segment", () => {
  assert.equal(matches("*.txt", "a.txt"), true);
  assert.equal(matches("*.txt", "foo.txt"), true);
  assert.equal(matches("*.txt", "a/b.txt"), false);
  assert.equal(matches("*.txt", ".txt"), true);
});

test("double star crosses path separators", () => {
  assert.equal(matches("**", "anything"), true);
  assert.equal(matches("**", "a/b/c"), true);
  assert.equal(matches("**", ""), true);
});

test("question mark matches exactly one non-separator", () => {
  assert.equal(matches("?.txt", "a.txt"), true);
  assert.equal(matches("?.txt", "ab.txt"), false);
  assert.equal(matches("?.txt", "/.txt"), false);
});

test("character class matches a listed char", () => {
  assert.equal(matches("[abc].txt", "a.txt"), true);
  assert.equal(matches("[abc].txt", "c.txt"), true);
  assert.equal(matches("[abc].txt", "d.txt"), false);
});

test("character class range works", () => {
  assert.equal(matches("[0-9].txt", "5.txt"), true);
  assert.equal(matches("[0-9].txt", "a.txt"), false);
});

test("negated character class works", () => {
  assert.equal(matches("[!abc].txt", "d.txt"), true);
  assert.equal(matches("[!abc].txt", "a.txt"), false);
});

test("regex meta characters in the glob are literal", () => {
  assert.equal(matches("a.b", "a.b"), true);
  assert.equal(matches("a.b", "axb"), false);
  assert.equal(matches("(test)", "(test)"), true);
  assert.equal(matches("a+c", "a+c"), true);
});

test("path separator is literal and blocks single star", () => {
  assert.equal(matches("a/b", "a/b"), true);
  assert.equal(matches("a/b", "a\\b"), false);
  assert.equal(matches("a/*", "a/b"), true);
  assert.equal(matches("a/*", "a/b/c"), false);
});

test("ignoreCase option makes the regex case-insensitive", () => {
  assert.equal(matches("FOO", "foo", { ignoreCase: true }), true);
  assert.equal(matches("FOO", "foo"), false);
});

test("unterminated character class throws", () => {
  assert.throws(() => globToRegex("[abc"), SyntaxError);
});

test("literal ] inside class is rejected", () => {
  assert.throws(() => globToRegex("[]"), SyntaxError);
});

test("empty glob matches only empty string", () => {
  assert.equal(matches("", ""), true);
  assert.equal(matches("", "x"), false);
});
