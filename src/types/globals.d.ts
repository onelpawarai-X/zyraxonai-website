// Project-wide typing helpers.
//
// Most network code in this project reads JSON bodies from `fetch()` and
// Supabase/GitHub responses whose shapes are validated at runtime rather than
// with generated types. The DOM lib types `Body.json()` as `Promise<any>` in
// older versions but as `Promise<unknown>` in newer ones, which produces
// hundreds of `'x' is of type 'unknown'` errors across existing code.
//
// Re-declaring the overload here keeps the runtime behaviour identical while
// restoring the looser typing this codebase was written against.
interface Body {
  json(): Promise<any>;
}

interface Response {
  json(): Promise<any>;
}

interface Request {
  json(): Promise<any>;
}
