/// <reference types="vite/client" />

// SPFx generates typed *.module.scss.ts files; the local harness uses this generic declaration instead.
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
