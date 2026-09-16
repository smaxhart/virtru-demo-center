/**
 * Where this app is mounted inside Demo Center.
 *
 * The Secure AI experience was built as its own Electron app with its own router at the root, so
 * every link inside it was absolute: `/`, `/build`, `/dow/chat`. Mounted here it lives under one of
 * Demo Center's routes, and an absolute `/dow/chat` would navigate the whole window out of the page
 * rather than within it.
 *
 * Rather than convert every link to relative — which reads fine at the call site and then breaks
 * the moment a component is used from a different depth — the prefix is named once, here, and
 * applied explicitly. `AI_ROOT` matches the path in src/App.jsx and the nav entry in
 * src/components/Layout.jsx; those three are the only places the mount point appears.
 *
 * The path is `/ai-agent` and not `/ai-protection`, which would read better, because that string is
 * also the key sellers' saved page-visibility preferences are stored under, and the target of any
 * link anyone has already shared.
 */
export const AI_ROOT = '/ai-agent'

/** Join path segments onto the mount point. `aiPath('dow', 'chat')` → `/ai-agent/dow/chat` */
export const aiPath = (...segments) =>
  [AI_ROOT, ...segments.filter(s => s !== undefined && s !== null && s !== '')].join('/')
