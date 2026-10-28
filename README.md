# glob-regex-tools

Convert glob patterns to anchored regular expressions, in pure ESM JavaScript with zero dependencies.

## Usage

```js
import { globToRegex } from "glob-regex-tools";

const re = globToRegex("src/**/*.js");
re.test("src/a.js");        // true
re.test("src/dir/b.js");    // true
re.test("src/dir/b.txt");   // false

// case-insensitive matching
const ci = globToRegex("README*", { ignoreCase: true });
ci.test("readme.md");       // true
```

## Why this exists

Translating a glob into a regex is a five-line problem on the happy path and
a rabbit hole on every edge. This library picks one set of answers and stops:

- `*` matches anything except `/`.
- `**` matches anything, including `/`.
- `?` matches one character that is not `/`.
- `[abc]`, `[a-z]`, and `[!abc]` work as character classes.
- Everything else is literal.
- The returned `RegExp` is always anchored with `^` and `$`.

The trade-off: there is no brace expansion, no extglob, and no escape syntax.
If you need any of those, this is the wrong library. The advantage is that the
output is predictable and auditable — you can read the generated regex and
reason about what it will match.

## Edge you will hit

A literal `]` inside a character class (`[a]b]`) is rejected with a
`SyntaxError`. Supporting it would require an escape rule, and this library
deliberately has none — backslashes are ordinary characters, not escapes.
If you need to match a literal `]`, place it outside a class.

## API

### `globToRegex(glob: string, options?: { ignoreCase?: boolean }): RegExp`

Returns an anchored `RegExp`. Pass `{ ignoreCase: true }` for case-insensitive
matching. Throws `SyntaxError` for an unterminated or otherwise unsupported
character class.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

