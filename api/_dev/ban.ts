// Ban a player: deletes the account and board row, and blocks the e-mail from registering again.
//   npx tsx --env-file=.env.local api/_dev/ban.ts --name "MILFZIGER"     (dry run: shows who matches)
//   npx tsx --env-file=.env.local api/_dev/ban.ts --name "MILFZIGER" --yes
//   npx tsx --env-file=.env.local api/_dev/ban.ts --email someone@example.com --yes
import { getKv } from '../_lib/kv.js'
import { banAccount, banEmail, findByName } from '../_lib/ban.js'
import { maskEmail } from '../_lib/auth.js'

const args = process.argv.slice(2)
const arg = (flag: string) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const yes = args.includes('--yes')
const name = arg('--name')
const email = arg('--email')

const kv = getKv()
if (!kv) {
  console.error('KV_REST_API_URL / KV_REST_API_TOKEN yok. --env-file=.env.local ile çalıştır.')
  process.exit(1)
}
if (email) {
  if (!yes) console.log(`Silinecek ve banlanacak: ${maskEmail(email)}. Onay için --yes ekle.`)
  else console.log(`Banlandı: ${maskEmail(email)} (${(await banEmail(kv, email, 'manual')).slice(0, 8)})`)
} else if (name) {
  const hits = await findByName(kv, name)
  if (hits.length === 0) console.log(`Tabloda "${name}" yok.`)
  for (const hit of hits) {
    if (!yes) console.log(`Bulundu: ${hit.companyName} · ${maskEmail(hit.email)}. Silmek ve banlamak için --yes ekle.`)
    else {
      await banAccount(kv, hit.h, `name:${hit.companyName}`)
      console.log(`Banlandı: ${hit.companyName} · ${maskEmail(hit.email)}`)
    }
  }
} else {
  console.log('Kullanım: --name "Şirket Adı" veya --email adres, sonra --yes')
}
