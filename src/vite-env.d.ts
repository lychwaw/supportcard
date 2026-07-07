/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPKIT_TOKEN_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}