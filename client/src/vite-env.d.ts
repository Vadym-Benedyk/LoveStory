/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_GOOGLE_MAPS_EMBED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// SCSS modules
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
