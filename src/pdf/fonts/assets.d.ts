declare module '*.ttf' {
  /** Base64 of the file, from esbuild's base64 loader. */
  const base64: string;
  export default base64;
}
