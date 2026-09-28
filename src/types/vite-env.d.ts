/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '$' {
  export const GM_xmlhttpRequest: any;
  export const GM_download: any;
  export const GM_setValue: any;
  export const GM_getValue: any;
  export const GM_setClipboard: any;
}
