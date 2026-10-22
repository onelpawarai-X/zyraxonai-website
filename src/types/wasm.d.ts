// A `.wasm` import resolves to an already-compiled module under the app's
// bundler, and to the same thing under the test runner's loader
// (`scripts/raw-import-loader.mjs`). TypeScript has no built-in type for that
// import, so it is declared here.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
