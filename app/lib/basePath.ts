// Prefix for plain URLs that Next does not rewrite (e.g. <img src>). Next/link and Next assets are prefixed by Next itself.
export const withBasePath = (p: string) => (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + p
