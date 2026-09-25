# Be Unicorn — Backend (Vercel Functions + Upstash Redis)

E-posta + 4 haneli PIN ile giriş, bulut kaydı ve canlı leaderboard. Sunucu kodu `api/`, istemci katmanı `src/net/`.

## Kurulum (Vercel)

1. Repo'yu Vercel'e bağla (Framework: Vite; `vercel.json` build/rewrites/fonksiyonları zaten tanımlıyor).
2. Vercel → Storage → Marketplace → **Upstash for Redis** → projeye bağla. `KV_REST_API_URL` ve `KV_REST_API_TOKEN` otomatik eklenir. (Kendi Upstash hesabınla `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` da olur.)
3. **Zorunlu (Production):** `PIN_PEPPER` — en az 16 karakter uzun rastgele metin (ör. `openssl rand -base64 32`). **Bir kez koy, değiştirme**, yoksa eski PIN'ler tutmaz. Yalnızca Vercel env'inde durur, Redis'e yazılmaz. Production'da yoksa API 503 `notConfigured` döner (oyun çevrimdışı oynar) ve logda sebebi yazar. İsteğe bağlı: `ALLOWED_ORIGINS` (sitenin kendi alan adı dışında API'yi çağırabilecek ek host'lar).
4. Deploy. Kontrol: `https://<site>/api/health` → `{"ok":true}`. Redis ya da pepper yoksa 503 `notConfigured` döner ve oyun çevrimdışı moda düşer. Sonra tarayıcıda kayıt → oyna → Liderlik.
5. Öneri: Upstash konsolunda aylık bütçe/komut uyarısı; Vercel Firewall'da `/api/*` için IP başına rate limit kuralı (Redis'e hiç gitmeden keser).

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
| `/api/auth/me` | GET / DELETE | Bearer | token kontrolü + yenileme (`MeOk`) / çıkış; `DELETE ?all=1` hesabın tüm oturumlarını kapatır |
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

- **Açılış** (`bootCloud`): health yoksa önce bir kez daha denenir (1,5 sn sonra, yalnız ağ hatası / 5xx'te); bu cihazda token varsa health düşse bile `resumeSession` denenir. Yine yoksa → çevrimdışı, başlangıç kartı eskisi gibi (yerel kayıt), ve backend 30 sn → 2 dk aralıkla ve tarayıcının `online` olayında yeniden yoklanır: dönünce token'lı oyuncu hesabına bağlanır (oyun ekrandaysa kayıt değiştirilmez, senkron başlar), token'sız oyuncu başlangıç kartındaysa giriş kartı açılır. Varsa ve bu cihazda token varsa → `resumeSession` (PIN'siz) → bulut kaydı çekilir → "Devam et (Şirket · aşama · gün)". Token yoksa → giriş kartı (`ui/start/LoginCard.tsx`).
- **Giriş kartı:** e-posta + PIN → `login`. `unknownEmail` gelirse kart kayıt moduna döner (PIN korunur): PIN tekrar + şirket adı + "Liderlikte om***@… olarak görünürsün" notu → `register` → oyun hemen açılır. "Çevrimdışı oyna" her şeyi atlar. PIN unutma akışı yok.
- **Hangi kayıt:** yerel kaydın yanında `be-unicorn:save-meta` `{at, owner}` tutulur. Bulut kaydı alınır: yerel yoksa, yerel başka hesabınsa ya da bulut oyunda daha ilerideyse (önce runIndex, sonra oyun günü). İki makinenin saatine bakılmaz. "Buluttaki kayıt geldi" yalnızca gelen kopya cihazdakinden farklıysa yazar. Başka hesabın yerel kaydı silinir (o kayıt kendi bulutunda); sahipsiz (çevrimdışı) kayıt giriş yapan hesaba geçer.
- **Bulut kaydı:** oyun ekrandayken başta bir kez, her maaş gününde, 30 sn'de bir, sayfa gizlenince; aynı anda tek yazma, değişmeyen durum yazılmaz, başarısız yazma sonraki tetikte / `online` olayında tekrar dener. 409 `conflict`: bu cihaz en az sunucu kadar ilerideyse `force` ile yazar; geride ise yazmayı durdurur ve Ayarlar › Hesap'ta seçim sunar ("Buluttakini yükle" / "Bu cihazdakini tut").
- **Skor:** aşama değişimi (+ replay), oyun sonu, maaş günü, 60 sn'de bir ve Liderlik paneli açıkken her yenilemeden önce (kendi satırın üst barla aynı sayıları gösterir); 1. günden önce ve değişiklik yoksa gönderilmez. Reddedilen bitmiş koşu (oyun sonu) 3 kez daha denenir. Koşu `newRunStage` ile reddedilirse (ör. girişten önce çevrimdışı ilerlemiş) o koşu için gönderim durur ve bir cümle gösterilir. `team = employees.length + 1`.
- **Liderlik:** üst barda kupa (L kısayolu) + sağ panelde "Liderlik". Panel açıkken 10 sn, kapalıyken 60 sn'de bir yenilenir (kupadaki "#12" rozeti); sekme gizliyken durur. Satır: sıra, startup, aşama, değerleme (büyük sayı; listenin üstünde "Startup · Değerleme" başlığı), maskeli e-posta (kendi satırında tam), kasa, "7 ay (210 gün)", "18 kişilik ekip". Üstte kendi sıran ve bir üstündekine fark.
- **Çıkış:** Ayarlar › Hesap › Çıkış yap (iki adım): son bulut yazması, token silinir, sayfa giriş kartına döner. İkinci adımda "Tüm cihazlardan çık" hesabın bütün oturumlarını kapatır (PIN başkasının eline geçtiyse).
- Testler: `tests/online.e2e.test.ts` (istemci + gerçek handler'lar + bellek içi Redis: kayıt → kayıt yazma → skor → tablo → ikinci cihaz → çakışma; çevrimdışı mod).

Önceki öneri (tarihçe): açılışta `backendStatus()` → çevrimiçiyse `resumeSession()`; olmazsa giriş formu (e-posta + PIN; `unknownEmail` gelirse şirket adı alanı açılır → `register`). Girişten sonra `getSave()`; bulut kaydı yereldekinden ilerideyse (runIndex, day) onu yükle. Otomatik kayıtta `putSave(serialize(state))`, belirli aralıkla ve aşama değişince / oyun sonunda `submitScore({... team: employees.length + 1, status})`.

## Redis şeması

| Anahtar | İçerik | TTL |
|---|---|---|
| `user:{h}` | `{email, pinHash, salt, companyName, createdAt}` (scrypt N=16384, 16 bayt tuz) | – |
| `session:{sha256(token)}` | `{h, createdAt}` | 90 gün, uygulama açılışında (`/me`) yenilenir; `createdAt`'ten 180 gün sonra her durumda ölür |
| `sessions:{h}` | hesabın oturumları `[{th, at}]` (en çok 10; fazlası en eskiden silinir) | 180 gün |
| `save:{h}` | `{rev, updatedAt, day, stage, runIndex, data}` (data ≤ 160 KB) | – |
| `lock:save:{h}` | eşzamanlı yazma kilidi | 5 sn |
| `lb` | sorted set, üye `h`, skor aşağıda | – |
| `lb:row:{h}` | görünen satır (tam e-posta burada; yanıtta maskelenir) | – |
| `lb:track:{h}` | koşunun son kabul edilen gönderimi + koşunun sunucuda ilk görüldüğü an/gün (makullük kontrolü) | – |
| `lb:replay:{h}` | aşama değişimindeki replay (denetim için) | 30 gün |
| `rl:pin:{h}` | giriş denemesi sayacı, PIN'e bakmadan önce artar (5 → kilit; pencere her denemede yeniden 15 dk) | 15 dk |
| `rl:pinday:{h}` | günlük giriş denemesi sayacı (30) | 24 saat |
| `rl:{bucket}:{sha256(id)}:{window}` | sabit pencere sayacı; `id` imzalı rotalarda hesap, diğerlerinde IP | pencere |

`h = sha256("be-unicorn:" + normalize(email))`.

**Skor:** önce aşama, sonra değerleme: `aşama × 1e12 + değerleme`. Unicorn'da daha az oyun günü önde: `6e12 + (1e6 − gün) × 1e5 + değerleme/1e5`. Hepsi 2^53 altında, tam sayı.

**Koşular:** gönderimde `runIndex` var. Yeni koşu satırı değiştirir; eski koşudan gelen 409 `staleRun`. Unicorn'la biten koşu, daha iyi bir koşu gelene kadar tabloda kalır, kazandığı şirket adıyla.

## Güvenlik

- PIN yalnızca scrypt hash'i olarak saklanır (+ `PIN_PEPPER`, production'da zorunlu), karşılaştırma `timingSafeEqual`.
- **Giriş denemeleri PIN'e bakılmadan önce sayılır** (atomik `INCR`): e-posta başına 15 dakikada 5 (pencere her denemede yeniden başlar), günde 30. Sınırı geçen istek scrypt'e hiç girmez, doğru PIN de 429 `locked` alır; paralel istekler kilidi aşamaz. Kayıtlı olmayan e-posta da aynı sayaçtan düşer ve sahte bir scrypt çalıştırır (yanıt süresi hesabın varlığını ele vermez). 404 `unknownEmail` bilerek duruyor: kayıt akışı bununla açılıyor.
- Oturumlar: token 32 rastgele bayt (base64url), Redis'te yalnızca SHA-256'sı. Açılışta 90 gün yenilenir, 180 günde kesin ölür. "Tüm cihazlardan çık" hepsini siler.
- Rate limit: imzalı rotalarda (save, submit, imzalı leaderboard) **hesap başına** (aynı NAT/ofis ağındaki oyuncular birbirini kesmesin): save 60/dk, submit 30/dk, board 30/dk. İmzasız: login 60/10 dk, register 30/saat, `/me` 120/dk, anonim board 120/dk (IP başına). Sınırı geçmiş anahtar, pencere bitene kadar fonksiyon belleğinden reddedilir (Redis komutu harcamaz).
- Boyut: gövde ≤ 400 KB, kayıt ≤ 160 KB (gerçek kayıtlar ~40 KB), replay ≤ 200 KB.
- Aynı origin: CORS başlığı hiç gönderilmez; başka bir `Origin`'den gelen istek 403. `vercel.json` Content-Security-Policy gönderir (yalnız `'self'`; dış script yok).
- Şirket adı: NFC, kontrol / sıfır genişlik / bidi karakterleri ve `<>\`"\\{}` silinir, sonra başlangıç ekranıyla aynı kural (`src/net/companyRules.ts`: 2–32 karakter, link yok, küfür yok). Kayıtta kurala uymayan ad 400; skor gönderiminde yok sayılır (hesap eski adını korur). Aynı koşuda ad günde bir kez değişebilir, yeni koşu yeni ad getirebilir.
- Leaderboard yanıtında e-posta maskeli (`om***@helio.studio`); yalnızca sahibi kendi satırında tam hâlini görür. Alan adı bilerek açık (kullanıcının seçtiği biçim).

## Hile azaltma (sunucu, `api/_lib/leaderboard.ts`)

Mutlak sınırlar: aşama 0–6 tam sayı; değerleme ≥ 0 ve ≤ sonraki aşama hedefi × 20; Unicorn'da ≥ $500M; kasa ≤ max($2M, 3 × değerleme); ekip ≤ 2 × aşama slotu + 5; her aşamanın en erken inanılır günü `MIN_DAY_FOR_STAGE` = 0 / 65 / 120 / 210 / 380 / 560 / 1000 (`src/net/stageRules.ts`; gerçek engine'de 160 bot koşusunun en hızlısının ~%65'i, ölçüm: `npx tsx sim/minStageDays.ts`; denge değişirse yeniden ölç).
Koşunun ilk görülüşü: en çok Pre-seed (`newRunStage`), gün hesabın yaşına sığmalı (+30 gün). Koşu içinde: gün ve aşama geri gitmez; gün farkı, geçen gerçek süreye en yüksek hızda (4×, 2 sn/gün, +%25) sığmalı — hem önceki gönderimden beri (+3 gün) hem koşunun ilk görüldüğü andan beri (+10 gün; küçük gönderimlerle pay biriktirilemez); değerleme en çok `max(önceki, $1M) × 10^(1 + Δgün/60)` büyür. Aşama başına gönderimden gönderime gün şartı yok (5 → 6 turu olmayan, yalnız değerlemeyle gelen bir adım; maaş gününden 1 gün sonra gelen Unicorn kabul edilir).

**Replay doğrulaması yapılmıyor** (yalnızca saklanıyor): sebep ve koşullar için bkz. aşağı.

## Bilinen sınırlar

- Sunucu tarafında replay ile yeniden simülasyon yok. Engine saf ama (1) oyun yüklenen kayıttan devam ettiğinde replay günlüğü 0. günden değil kayıttan başlar (`fromSave`), kayıt da istemciden gelir; (2) fonksiyonlar derlenmiş dosya başına ESM çalışır, engine/content'in uzantısız importları Node ESM'de çözülmez (bundle adımı gerekir); (3) uzun koşuların yeniden simülasyonu 10 sn fonksiyon süresini zorlar. Replay aşama değişiminde `lb:replay:{h}`'e 30 gün saklanır, çevrimdışı denetim yapılabilir.
- Aynı koşuda eski bir kaydı `force` ile geri yükleyen oyuncunun gönderimleri, yeniden eski gününü geçene kadar `dayBackwards` alır (tablodaki satırı değişmez).
- Sınırlar kaba: kararlı bir hileci (API'yi elle çağıran) koşuyu Garaj'dan başlatıp gerçek zamanda bekleyerek, oyunun izin verdiği en kısa sürede (≈1000. gün, 4×'te ~7 dk) Unicorn gönderebilir; bu, en iyi bot koşusundan (1529. gün) hızlı. Kesin çözüm sunucuda replay doğrulaması. Amaç şimdilik elle düzenlenmiş uçuk sayıları ve "29 günde Unicorn"u durdurmak.
- Girişten önce çevrimdışı Pre-seed'i geçmiş bir koşu tabloya giremez (`newRunStage`); oyuncu yeni oyunla girer.
- PIN unutma akışı yok (e-posta doğrulaması gerekir). 4 hane: e-posta başına günde 30 deneme ile ortalama ~5 ay; 6 haneye geçmek bir seçenek.
