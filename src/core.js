/**
 * glob-regex-tools — convert a glob pattern to an anchored regular expression.
 *
 * Supported glob syntax (intentionally small):
 *   *      matches any run of characters EXCEPT a path separator
 *   ?      matches a single character that is not a path separator
 *   **     matches any run of characters INCLUDING path separators
 *   [abc]  character class — matches one of the listed characters
 *   [a-z]  range inside a character class
 *   [!abc] negated character class
 *   any other character matches itself literally
 *
 * Decisions taken (the brief asked for one clear reading, not several):
 *
 * 1. Path separator is the forward slash "/". Backslashes are ordinary
 *    characters, not separators and not escapes. This keeps the library
 *    platform-neutral and avoids the classic split where "\" means escape
 *    on Windows but separator on Unix.
 *
 * 2. A "*" never crosses a "/". Only the two-star sequence "**" does. This
 *    mirrors how most developers expect glob semantics in a URL or POSIX path
 *    context. A lone "**" matches everything, including empty strings and
 *    strings full of slashes.
 *
 * 3. Character classes are translated almost verbatim into regex character
 *    classes. We reject classes containing a literal "]" because supporting it
 *    would require an escape rule, and we chose not to have one (see decision 1).
 *
 * 4. The returned RegExp is always anchored (starts with ^ and ends with $) so
 *    that it describes a full-path match, not a substring search. Callers who
 *    want substring behaviour can strip the anchors themselves.
 *
 * 5. Flags default to "" (case-sensitive). An options object may override:
 *     { ignoreCase: true }  -> flags become "i"
 */

/**
 * @typedef {Object} GlobOptions
 * @property {boolean} [ignoreCase] - When true, the returned RegExp is
 *   case-insensitive. Defaults to false.
 */

/**
 * Characters that have special meaning inside a regex character class.
 *
 * We escape them so that, e.g., a glob class "[a.]" becomes the regex class
 * "[a\\.]" rather than "[a.]" (where the dot would still match a literal dot,
 * but escaping is the defensive, predictable choice).
 */
const CLASS_META = new Set(["\\", "]", "-", "^"]);

/**
 * Escape a character so it is treated literally when placed inside a regex
 * character class.
 *
 * @param {string} ch - A single character.
 * @returns {string} The character, escaped if it is regex-class-meta.
 */
function escapeClassChar(ch) {
  return CLASS_META.has(ch) ? "\\" + ch : ch;
}

/**
 * Read a glob character class starting at index `start` (which points at the
 * opening "[") and return both the translated regex fragment and the index
 * just past the closing "]".
 *
 * @param {string} glob - The full glob pattern.
 * @param {number} start - Index of the "[".
 * @returns {{ body: string, next: number }}
 * @throws {SyntaxError} If the class is never closed or contains a literal "]".
 */
function readClass(glob, start) {
  // i walks forward; we know glob[start] === "[".
  let i = start + 1;
  const negate = glob[i] === "!";
  if (negate) i += 1;

  // Reject a leading "]": in a regex class that would mean "literal ]" and we
  // have decided not to support literal ] inside glob classes (no escape rule).
  if (glob[i] === "]") {
    throw new SyntaxError(
      "glob-regex-tools: literal ']' inside a character class is not supported"
    );
  }

  let body = "";
  let inRange = false;
  let prev = null;

  while (i < glob.length && glob[i] !== "]") {
    const ch = glob[i];

    // Handle ranges: a "-" that is not first, not last, and not part of "[!"
    // becomes a regex range separator. We only treat "-" as a range operator
    // when it sits between two characters, never as a literal at the start or
    // end of the class body.
    if (ch === "-" && prev !== null && i + 1 < glob.length && glob[i + 1] !== "]") {
      body += "-";
      inRange = true;
      i += 1;
      continue;
    }

    body += escapeClassChar(ch);
    prev = ch;
    i += 1;
  }

  if (i >= glob.length) {
    throw new SyntaxError(
      "glob-regex-tools: unterminated character class in glob"
    );
  }

  // i now points at the closing "]"; step past it for the caller.
  return { body: "[" + (negate ? "^" : "") + body + "]", next: i + 1 };
}

/**
 * Convert a glob pattern into an anchored regular expression.
 *
 * @param {string} glob - The glob pattern to convert.
 * @param {GlobOptions} [options] - Optional flags.
 * @returns {RegExp} An anchored RegExp equivalent to the glob.
 * @throws {SyntaxError} If the glob contains an unterminated or otherwise
 *   unsupported character class.
 */
export function globToRegex(glob, options) {
  if (typeof glob !== "string") {
    throw new TypeError("glob-regex-tools: glob must be a string");
  }

  const ignoreCase = options && options.ignoreCase === true;
  let flags = "";
  if (ignoreCase) flags += "i";

  let out = "";
  let i = 0;

  while (i < glob.length) {
    const ch = glob[i];

    if (ch === "*") {
      // Peek for a second star. If present, "**" matches anything including
      // slashes; a lone "*" matches anything except a slash.
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^/]*";
        i += 1;
      }
      continue;
    }

    if (ch === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }

    if (ch === "[") {
      const { body, next } = readClass(glob, i);
      out += body;
      i = next;
      continue;
    }

    // Any other character: escape it if it has regex meta-meaning, otherwise
    // copy it through. We deliberately do NOT treat "/" as special here — it
    // is a literal separator that passes straight through.
    if (".^$+(){}|\\".includes(ch)) {
      out += "\\" + ch;
    } else {
      out += ch;
    }
    i += 1;
  }

  return new RegExp("^" + out + "$", flags);
}
