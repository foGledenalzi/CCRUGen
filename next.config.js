// Static export only (FND-03). NEXT_PUBLIC_BASE_PATH optionally sets a sub-path such as /ccrug (D-06).
const raw = process.env.NEXT_PUBLIC_BASE_PATH || ''
if (raw && !/^\/[^/](.*[^/])?$/.test(raw)) {
  throw new Error(`NEXT_PUBLIC_BASE_PATH must start with "/" and not end with "/", got "${raw}" (Git Bash rewrites /x paths: use cross-env or MSYS_NO_PATHCONV=1)`)
}

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  trailingSlash: true,
  ...(raw ? { basePath: raw } : {}),
  eslint: { dirs: ['app', 'engine', 'workers'] }, // absent dirs are tolerated (verified)
}
