// Shoots the shop thumbnails (T11) from the dev server's item studio into public/items/{id}@1x.png / @2x.png.
// Usage: npm run dev (port 5173, or PORT=…), then `npx -y -p playwright@1 node scripts/shoot-items.mjs`.
// Needs a Chromium for Playwright (`npx playwright install chromium`, or CHROME=/path/to/chrome).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = process.env.PORT ?? '5173'
const out = new URL(process.env.OUT ?? '../public/items/', import.meta.url)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
let n = 0
for (const [size, scale] of [[128, 1], [256, 2]]) {
  for (let page = 0; ; page++) {
    const tab = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
    await tab.goto(`http://localhost:${port}/?studio=items&size=${size}&page=${page}`)
    await tab.waitForTimeout(1500)
    const shots = await tab.$$('[data-item]')
    if (shots.length === 0) {
      await tab.close()
      break
    }
    await tab.waitForTimeout(2000)
    for (const el of shots) {
      const id = await el.getAttribute('data-item')
      await el.screenshot({ path: new URL(`${id}@${scale}x.png`, out).pathname, omitBackground: true })
      n++
    }
    await tab.close()
  }
}
await browser.close()
console.log(`${n} item shots written`)
