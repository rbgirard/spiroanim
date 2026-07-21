import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const projectRoot = process.cwd()
const clientDirectory = path.resolve(projectRoot, 'build')
const serverEntryUrl = pathToFileURL(
  path.resolve(projectRoot, 'build-server', 'entry-server.js'),
).href
const { clientOnlyPaths, render } = await import(serverEntryUrl)
const template = await readFile(path.join(clientDirectory, 'index.html'), 'utf8')
const appShell = await readFile(path.join(clientDirectory, 'app-shell.html'), 'utf8')

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function pageHtml(appHtml, seo) {
  const canonicalUrl = new URL(seo.canonicalPath, 'https://spiroanim.com').href
  const socialImageUrl = 'https://spiroanim.com/pwa-512x512.png'
  const seoHead = [
    `<meta name="description" content="${escapeHtml(seo.description)}">`,
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}">`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:image" content="${socialImageUrl}">`,
  ].join('\n    ')

  return template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="robots" content=".*?">/, `<meta name="robots" content="${seo.robots}">`)
    .replace('<!--seo-head-->', seoHead)
    .replace('<div id="app">', '<div id="app" data-prerendered="true">')
    .replace('<!--ssr-outlet-->', appHtml)
}

async function writeRoute(route, html, includeCleanUrlFile = false) {
  const relativeRoute = route.replace(/^\/+/, '')
  const routeDirectory = route === '/' ? clientDirectory : path.join(clientDirectory, relativeRoute)
  await mkdir(routeDirectory, { recursive: true })
  await writeFile(path.join(routeDirectory, 'index.html'), html)

  if (includeCleanUrlFile && route !== '/') {
    await writeFile(path.join(clientDirectory, `${relativeRoute}.html`), html)
  }
}

const landing = await render('/')
const about = await render('/about')

await writeRoute('/', pageHtml(landing.appHtml, landing.seo))
await writeRoute('/index', pageHtml(landing.appHtml, landing.seo))
await writeRoute('/about', pageHtml(about.appHtml, about.seo), true)

for (const route of clientOnlyPaths) await writeRoute(route, appShell, true)

console.log(
  `Prerendered / and /about; generated ${clientOnlyPaths.length} client-only route shells.`,
)
