// Shoots the portrait set (T16) from the dev server's photo studio into public/portraits/{id}@1x.png / @2x.png.
// Usage: npm run dev (port 5173, or PORT=…), then `npx -y -p playwright@1 node scripts/shoot-portraits.mjs`.
// Needs a Chromium for Playwright (`npx playwright install chromium`, or CHROME=/path/to/chrome).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = process.env.PORT ?? '5173'
const out = new URL('../public/portraits/', import.meta.url)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const [size, scale] of [[96, 1], [192, 2]]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(`http://localhost:${port}/?studio=portraits&size=${size}`)
  await page.waitForSelector('[data-portrait] canvas')
  await page.waitForTimeout(2500)
  for (const el of await page.$$('[data-portrait]')) {
    const id = await el.getAttribute('data-portrait')
    await el.screenshot({ path: new URL(`${id}@${scale}x.png`, out).pathname, omitBackground: true })
  }
  await page.close()
}
await browser.close()
console.log('portraits written to public/portraits')
