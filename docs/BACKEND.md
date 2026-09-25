# Be Unicorn — Backend (Vercel Functions + Upstash Redis)

E-posta + 4 haneli PIN ile giriş, bulut kaydı ve canlı leaderboard. Sunucu kodu `api/`, istemci katmanı `src/net/`.

## Kurulum (Vercel)

1. Repo'yu Vercel'e bağla (Framework: Vite; `vercel.json` build/rewrites/fonksiyonları zaten tanımlıyor).
2. Vercel → Storage → Marketplace → **Upstash for Redis** → projeye bağla. `KV_REST_API_URL` ve `KV_REST_API_TOKEN` otomatik eklenir. (Kendi Upstash hesabınla `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` da olur.)
3. İsteğe bağlı: `PIN_PEPPER` (uzun rastgele metin; **bir kez koy, değiştirme** yoksa eski PIN'ler tutmaz), `ALLOWED_ORIGINS` (sitenin kendi alan adı dışında API'yi çağırabilecek ek host'lar).
4. Deploy. Kontrol: `https://<site>/api/health` → `{"ok":true}`. Redis yoksa 503 `notConfigured` döner ve oyun çevrimdışı moda düşer.

Değişken listesi: `.env.example`. Yerelde `vercel env pull .env.local` (git'e girmez).

## Yerel geliştirme

- `npm run dev` (yalnız Vite): `/api/*` yok → `backendStatus()` = `'offline'` → yerel kayıt, leaderboard gizli. Giriş ekranı atlanabilir.
- Fonksiyonlarla birlikte: `vercel dev` (Redis env'i gerekir). Etkileşimli ve sonsuz çalışır; betiklerde ön planda çalıştırma.
- `VITE_OFFLINE=1` istemciyi her durumda çevrimdışı tutar.
- **Sahte API ile tam akış:** `MOCK_API=1 npm run dev` → `/api/*` gerçek handler'larla, bellek içi Redis üzerinde çalışır (`api/_dev/devApi.ts`, vite.config.ts'teki middleware). Sunucu kapanınca veri gider. Ekran görüntüsü için `POST /api/dev/seed {rows:[…]}` tabloya doğrudan satır koyar (yalnız dev).
- Testler: `npx vitest run api src/net` (Redis yerine bellek içi `api/_lib/memoryKv.ts`).

## Uç noktalar

| Yol | Yöntem | Kimlik | Gövde → yanıt |
|---|---|---|---|
| `/api/health` | GET | – | `{ok:true}` / 503 `notConfigured` |
| `/api/auth/register` | POST | – | `{email, pin, companyName}` → 201 `AuthOk` · 409 `emailTaken` |
| `/api/auth/login` | POST | – | `{email, pin}` → `AuthOk` · 404 `unknownEmail` · 401 `wrongCredentials` (+`attemptsLeft`) · 429 `locked` |
| `/api/auth/me` | GET / DELETE | Bearer | token kontrolü + yenileme (`MeOk`) / çıkış |
| `/api/save` | GET / PUT | Bearer | `SaveGetOk` / `{data, baseRev, force?}` → `SavePutOk` · 409 `conflict` + `server` |
| `/api/leaderboard` | GET `?limit=50` | Bearer (isteğe bağlı) | `LeaderboardOk` (+ `me`, `above`, `gap`) |
| `/api/leaderboard/submit` | POST | Bearer | `LeaderboardSubmitBody` → `LeaderboardSubmitOk` · 422 `invalidMetrics` (+`detail`) · 409 `staleRun` |

Tipler: `src/net/contract.ts` (sunucu ve istemci aynı dosyayı kullanır). Hata kodlarının Türkçe metni: `src/net/netText.ts`.

## İstemci katmanı (`src/net/`)

- `api.ts`: `backendStatus()`, `register`, `login`, `resumeSession` (aynı cihazda PIN'siz devam), `logout`, `getSave`, `putSave` (cihazın son gördüğü `rev` ile; çakışmada `server` kopyası döner, oyuncu seçer: buluttakini al ya da `force: true`), `submitScore`, `getLeaderboard`, `pollLeaderboard(cb)` (10 sn, sekme gizliyken durur, çevrimdışıyken hiç çalışmaz). Hiçbiri throw etmez: `{ok:true,data}` ya da `{ok:false,error,message}`.
- `session.ts`: `be-unicorn:session` (token, e-posta, şirket adı, `cloudRev`), try/catch'li localStorage.
- `netText.ts`: hata metinleri, `runLengthText(210)` → "7 ay (210 gün)", `teamText(18)` → "18 kişilik ekip".
- `stageRules.ts`: sunucunun kontrol için kullandığı aşama sayıları (test, `content/stages.ts` ile eşitliği korur).

## Oyuna bağlanış (`src/net/cloud.ts`)

- **Açılış** (`bootCloud`): backend yoksa → çevrimdışı, başlangıç kartı eskisi gibi (yerel kayıt). Varsa ve bu cihazda token varsa → `resumeSession` (PIN'siz) → bulut kaydı çekilir → "Devam et (Şirket · aşama · gün)". Token yoksa → giriş kartı (`ui/start/LoginCard.tsx`).
- **Giriş kartı:** e-posta + PIN → `login`. `unknownEmail` gelirse kart kayıt moduna döner (PIN korunur): PIN tekrar + şirket adı + "Liderlikte om***@… olarak görünürsün" notu → `register` → oyun hemen açılır. "Çevrimdışı oyna" her şeyi atlar. PIN unutma akışı yok.
- **Hangi kayıt:** yerel kaydın yanında `be-unicorn:save-meta` `{at, owner}` tutulur. Bulut kaydı alınır: yerel yoksa, yerel başka hesabınsa, bulut koşusu (runIndex) daha yeniyse ya da aynı koşuda `updatedAt > at` ise. Başka hesabın yerel kaydı silinir (o kayıt kendi bulutunda); sahipsiz (çevrimdışı) kayıt giriş yapan hesaba geçer.
- **Bulut kaydı:** oyun ekrandayken başta bir kez, her maaş gününde, 30 sn'de bir, sayfa gizlenince; aynı anda tek yazma, değişmeyen durum yazılmaz, başarısız yazma sonraki tetikte / `online` olayında tekrar dener. 409 `conflict`: bu cihaz en az sunucu kadar ilerideyse `force` ile yazar; geride ise yazmayı durdurur ve Ayarlar › Hesap'ta seçim sunar ("Buluttakini yükle" / "Bu cihazdakini tut").
- **Skor:** aşama değişimi (+ replay), oyun sonu, maaş günü ve 60 sn'de bir; 1. günden önce ve değişiklik yoksa gönderilmez. `team = employees.length + 1`.
- **Liderlik:** üst barda kupa (L kısayolu) + sağ panelde "Liderlik". Panel açıkken 10 sn, kapalıyken 60 sn'de bir yenilenir (kupadaki "#12" rozeti); sekme gizliyken durur. Satır: sıra, startup, aşama, değerleme, maskeli e-posta (kendi satırında tam), kasa, "7 ay (210 gün)", "18 kişilik ekip". Üstte kendi sıran ve bir üstündekine fark.
- **Çıkış:** Ayarlar › Hesap › Çıkış yap (iki adım): son bulut yazması, token silinir, sayfa giriş kartına döner.
- Testler: `tests/online.e2e.test.ts` (istemci + gerçek handler'lar + bellek içi Redis: kayıt → kayıt yazma → skor → tablo → ikinci cihaz → çakışma; çevrimdışı mod).

Önceki öneri (tarihçe): açılışta `backendStatus()` → çevrimiçiyse `resumeSession()`; olmazsa giriş formu (e-posta + PIN; `unknownEmail` gelirse şirket adı alanı açılır → `register`). Girişten sonra `getSave()`; bulut kaydı yereldekinden ilerideyse (runIndex, day) onu yükle. Otomatik kayıtta `putSave(serialize(state))`, belirli aralıkla ve aşama değişince / oyun sonunda `submitScore({... team: employees.length + 1, status})`.

## Redis şeması

| Anahtar | İçerik | TTL |
|---|---|---|
| `user:{h}` | `{email, pinHash, salt, companyName, createdAt}` (scrypt N=16384, 16 bayt tuz) | – |
| `session:{sha256(token)}` | `{h, createdAt}` | 90 gün, her kullanımda yenilenir |
| `save:{h}` | `{rev, updatedAt, day, stage, runIndex, data}` (data ≤ 512 KB) | – |
| `lock:save:{h}` | eşzamanlı yazma kilidi | 5 sn |
| `lb` | sorted set, üye `h`, skor aşağıda | – |
| `lb:row:{h}` | görünen satır (tam e-posta burada; yanıtta maskelenir) | – |
| `lb:track:{h}` | koşunun son kabul edilen gönderimi (makullük kontrolü) | – |
| `lb:replay:{h}` | aşama değişimindeki replay (denetim için) | 30 gün |
| `rl:pin:{h}` | yanlış PIN sayacı (5 → 15 dk kilit) | 15 dk |
| `rl:ip:{bucket}:{sha256(ip)}:{window}` | IP başına sabit pencere sayacı | pencere |

`h = sha256("be-unicorn:" + normalize(email))`.

**Skor:** önce aşama, sonra değerleme: `aşama × 1e12 + değerleme`. Unicorn'da daha az oyun günü önde: `6e12 + (1e6 − gün) × 1e5 + değerleme/1e5`. Hepsi 2^53 altında, tam sayı.

**Koşular:** gönderimde `runIndex` var. Yeni koşu satırı değiştirir; eski koşudan gelen 409 `staleRun`. Unicorn'la biten koşu, daha iyi bir koşu gelene kadar tabloda kalır.

## Güvenlik

- PIN yalnızca scrypt hash'i olarak saklanır (+ isteğe bağlı `PIN_PEPPER`), karşılaştırma `timingSafeEqual`.
- E-posta başına 5 yanlış PIN → 15 dk kilit (doğru PIN de reddedilir). IP başına: auth 30 / 10 dk, save 120 / dk, submit 30 / dk, leaderboard 60 / dk.
- Token 32 rastgele bayt (base64url); Redis'te yalnızca SHA-256'sı.
- Aynı origin: CORS başlığı hiç gönderilmez; başka bir `Origin`'den gelen istek 403. Gövde ≤ 800 KB.
- Şirket adı: NFC, kontrol / sıfır genişlik / bidi karakterleri ve `<>\`"\\{}` silinir, boşluklar tekilleşir, 2–32 karakter, en az bir harf/rakam.
- Leaderboard yanıtında e-posta maskeli (`om***@helio.studio`); yalnızca sahibi kendi satırında tam hâlini görür.

## Hile azaltma (sunucu, `api/_lib/leaderboard.ts`)

Mutlak sınırlar: aşama 0–6 tam sayı; değerleme ≥ 0 ve ≤ sonraki aşama hedefi × 20; Unicorn'da ≥ $500M; kasa ≤ max($2M, 3 × değerleme); ekip ≤ 2 × aşama slotu + 5; `aşama × 5 gün ≤ gün`.
Koşu içinde: gün ve aşama geri gitmez; iki gönderim arasındaki gün farkı, geçen gerçek süreye en yüksek hızda (4×, 2 sn/gün) sığmalı (+%25, +3 gün); aşama başına en az 5 gün; değerleme en çok `max(önceki, $1M) × 10^(1 + Δgün/60)` büyür. Koşunun ilk gönderiminde gün, hesabın yaşına sığmalı (+30 gün).

**Replay doğrulaması yapılmıyor** (yalnızca saklanıyor): sebep ve koşullar için bkz. aşağı.

## Bilinen sınırlar

- Sunucu tarafında replay ile yeniden simülasyon yok. Engine saf ama (1) oyun yüklenen kayıttan devam ettiğinde replay günlüğü 0. günden değil kayıttan başlar (`fromSave`), kayıt da istemciden gelir; (2) fonksiyonlar derlenmiş dosya başına ESM çalışır, engine/content'in uzantısız importları Node ESM'de çözülmez (bundle adımı gerekir); (3) uzun koşuların yeniden simülasyonu 10 sn fonksiyon süresini zorlar. Replay aşama değişiminde `lb:replay:{h}`'e 30 gün saklanır, çevrimdışı denetim yapılabilir.
- Aynı koşuda eski bir kaydı `force` ile geri yükleyen oyuncunun gönderimleri, yeniden eski gününü geçene kadar `dayBackwards` alır (tablodaki satırı değişmez).
- Sınırlar kaba: kararlı bir hileci makul sayılarla yavaşça yükselebilir. Amaç elle düzenlenmiş uçuk sayıları durdurmak.
