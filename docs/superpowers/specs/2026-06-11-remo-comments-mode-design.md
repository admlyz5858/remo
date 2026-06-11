# remo — "Funny Comments" (AskReddit) Mode Tasarımı

**Tarih:** 2026-06-11
**Durum:** Tasarım onaylandı
**Bağlam:** İkinci bir içerik formatı/kanalı: AskReddit tarzı "soru + en komik yorumlar" Shorts. Mevcut fun-facts hattının altyapısını (TTS, altyazı, render-infra, müzik/SFX, upload, accent/tohum) yeniden kullanır; içerik kaynağı + Remotion şablonu + hedef kanal değişir. İkisi tek repoda **mode anahtarı** ile yaşar.

---

## 1. Amaç

İngilizce AskReddit "What's the funniest…" tarzı bir soru + 5-8 küratörlü komik yorumu, yorum kartları halinde TTS ile okuyan, tatmin-edici/gameplay arka plan üzerinde akan Shorts üretmek; ayrı bir YouTube kanalına private yüklemek.

- **Dil:** İngilizce. **Tema:** AskReddit soru-cevap. **Arka plan:** karışık (tatmin-edici stok + opsiyonel gameplay, tohumla).
- **Kanal:** DustMust'tan AYRI ikinci kanal.

---

## 2. Mode Anahtarı

- `pipeline/config.js` → `mode: "facts" | "comments"` (env `MODE` ile override; varsayılan `facts`).
- `pipeline/run.js` mode'a göre dallanır:
  - `facts`: 01-topic → 02-script → 03-voiceover → 04(captions via 03) → 05-media → 05c → 06-render(`Short`) → upload(DustMust)
  - `comments`: 01c-comments → 03-voiceover → (captions via 03) → 05b-background → 06-render(`Comments`) → upload(2. kanal)
- Ortak aşamalar paylaşılır. Mode yalnızca: içerik aşaması, render kompozisyon id'si, upload kanal token'ı, history dosyası bölümünü değiştirir.

---

## 3. İçerik Hattı — `01c-comments`

### 3.1 Kaynak çekme (`pipeline/lib/reddit.js`, `pipeline/lib/ytcomments.js`)
- **Reddit (birincil):** public JSON, auth yok, özel `User-Agent` zorunlu (Reddit varsayılan UA'ları engeller).
  - Subreddit havuzu (config): `["AskReddit", "AskReddit", "Showerthoughts", "tifu"]` vb.
  - `https://www.reddit.com/r/<sub>/top.json?t=week&limit=25` → uygun bir soru postu seç (soru işaretiyle biten, SFW, kilitsiz).
  - `https://www.reddit.com/r/<sub>/comments/<id>/.json?limit=80&sort=top` → top yorumlar (gövde, yazar, skor).
- **YouTube (ikincil, opsiyonel):** `commentThreads` (YouTube Data API, mevcut `YOUTUBE_API_KEY`) ile bir popüler videonun top yorumları. Mode için zenginlik; başarısızsa atlanır.
- Her iki kaynak `[{ author, text, score }]` ham yorum listesine normalize edilir.

### 3.2 Küratörlük (`02c-curate`, OpenRouter)
- LLM ham soru + yorumları alır; çıktı: en komik, **güvenli** (NSFW/küfür/nefret/kişisel-bilgi YOK), kendi başına anlaşılır 5-8 yorumu seçer, hafif temizler (URL/markdown/typo), gerekiyorsa kısaltır.
- Ayrıca `title`/`description`/`tags` üretir (SEO; `#shorts`, `#reddit`).
- **Çıktı `run/<id>/deck.json`:**
```json
{ "subreddit": "AskReddit",
  "question": "What's a small thing that instantly makes someone more likable?",
  "comments": [ { "id": 1, "author": "u/name", "text": "...", "upvotes": "12.4k" } ],
  "title": "...", "description": "...", "tags": ["reddit","askreddit","shorts"] }
```
- `upvotes` insan-okur formatında string (ör. "12.4k").

### 3.3 Seslendirme (paylaşılan 03-voiceover, uyarlanmış)
- Segment listesi: `[question, comment1, comment2, …]`. Her segmentin narration'ı TTS'lenir, birleştirilir, `applyTimings` ile zamanlanır (mevcut), kelime sınırları (`assembleCaptions`) üretilir.
- `03-voiceover` segment kaynağını mode'a göre `scenes.json` veya `deck.json`'dan alacak şekilde küçük bir uyarlama: ortak bir `segments` soyutlaması (her ikisi de `[{id, narration}]` verir).

---

## 4. Remotion `Comments` Kompozisyonu

`remotion/src/Comments.tsx` — `Short` ile aynı altyapı (Audio, müzik, ProgressBar, font, accent/tohum, EndCard).

### 4.1 Katmanlar
1. **BackgroundClip** — tek sürekli arka plan klibi (tatmin-edici stok / gameplay), `objectFit:cover`, hafif `blur(6px)` + karartma. Loop/trim kompozisyon süresine.
2. **QuestionCard** (üstte, sabit) — `r/<subreddit>` rozeti + soru metni; başta `spring` pop ile girer.
3. **CommentCard** (orta) — aktif yorum segmentine senkron: avatar dairesi + `u/author` + ⬆ upvote + yorum metni. `spring`+slide-in ile girer; segment sonunda fade. Aktif kelime hafif accent vurgusu (kelime sınırlarından, read-along).
4. **ProgressBar** + köşe kanal etiketi.
5. **CommentsEndCard** (son segment) — "Follow for daily Reddit 👇" + handle + FOLLOW butonu.

### 4.2 Veri akışı (inputProps — `buildCommentsProps`)
```json
{ "fps":30,"width":1080,"height":1920,
  "audioSrc":"<id>/voiceover.mp3","musicSrc":"<id>/music.mp3|null","musicVolume":0.1,
  "sfxSrc":"<id>/sfx.mp3|null",
  "backgroundSrc":"<id>/bg.mp4",
  "subreddit":"AskReddit","question":"…",
  "theme":{"accentColor":"…","fontFamily":"Anton","channelName":"@handle"},
  "captions":[…],
  "segments":[ { "kind":"question|comment", "author":"u/x|null", "upvotes":"12.4k|null",
                 "text":"…", "startFrame":0, "durationFrames":90 } ] }
```
- `segments` zamanlaması `applyTimings` çıktısından türetilir (her segment = bir TTS bloğu).

### 4.3 Saf yardımcılar (test edilir)
- `buildSegments(deck, durationsSec, fps)` → segment listesi (startFrame/durationFrames + kind/author/upvotes/text).
- `parseUpvotes("12.4k")`/sayaç hedefi → counter animasyonu için sayı.
- Mevcut `pickFrom`, `popScale`, `drawProgress` vb. yeniden kullanılır.

---

## 5. Arka Plan Klibi — `05b-background`

- Tek bir arka plan klibi seçer/indirir: `remotion/public/<id>/bg.mp4`.
- Kaynak (karışık, tohumla): (a) `remotion/public/gameplay/` klasöründe kullanıcı klibi varsa onlardan seç; (b) yoksa stok "satisfying/abstract/flowing" video (Pexels/Pixabay, mevcut sağlayıcılar). Boşsa düz koyu arka plan (render bozulmaz).
- `gameplay/` klasörü `.gitignore` muafiyeti (müzik/sfx gibi); kullanıcı doldurur.

---

## 6. İkinci Kanal & Upload

- Yeni kanal `scripts/get_youtube_token.js` ile yetkilendirilir (aynı OAuth app). Token ayrı secret: `YT_COMMENTS_REFRESH_TOKEN`.
- `scripts/upload_youtube.py`: `--refresh-token-env` argümanı eklenir (varsayılan `YOUTUBE_REFRESH_TOKEN`); comments mode `YT_COMMENTS_REFRESH_TOKEN` geçer. Client id/secret ortak.
- Her video private; onayla→public (`publish.yml` aynı; doğru kanal token'ı mode'a göre).

---

## 7. CI

- `produce.yml` → `workflow_dispatch` input `mode` (facts|comments, varsayılan facts).
- Pipeline env'ine `REDDIT_USER_AGENT` ve `YT_COMMENTS_REFRESH_TOKEN` eklenir; `MODE: ${{ inputs.mode }}`.
- Tetikleme: `gh workflow run produce.yml -f mode=comments`.
- `state/history.json` `mode` alanı taşır; dedup mode-bazlı (soru postu id'siyle tekrar önleme).

---

## 8. Etkilenen / Yeni Dosyalar

| Dosya | Değişiklik |
|---|---|
| `pipeline/config.js` | `mode`, `subreddits`, `gameplay dir`, comments accent/palette opsiyonel |
| `pipeline/lib/reddit.js` | (yeni) top post + yorum çekme (UA'lı) |
| `pipeline/lib/ytcomments.js` | (yeni) YouTube top yorumlar (opsiyonel) |
| `pipeline/01c-comments.js` | (yeni) kaynak çek → ham deck |
| `pipeline/02c-curate.js` | (yeni) LLM filtre/sırala/temizle → deck.json + meta |
| `pipeline/03-voiceover.js` | ortak `segments` soyutlaması (facts/comments) |
| `pipeline/05b-background.js` | (yeni) tek arka plan klibi seç/indir |
| `pipeline/lib/timeline.js` | `buildSegments` + `buildCommentsProps` |
| `pipeline/06-render.js` | mode'a göre kompozisyon id + props builder |
| `pipeline/run.js` | mode dallanması |
| `scripts/upload_youtube.py` | `--refresh-token-env` |
| `.github/workflows/produce.yml` | `mode` input + comments secrets |
| `.gitignore` | `remotion/public/gameplay/` muafiyeti |
| `remotion/src/schema.ts` | `commentsSchema` |
| `remotion/src/Comments.tsx` | (yeni) kompozisyon |
| `remotion/src/components/BackgroundClip.tsx` | (yeni) |
| `remotion/src/components/QuestionCard.tsx` | (yeni) |
| `remotion/src/components/CommentCard.tsx` | (yeni) |
| `remotion/src/components/CommentsEndCard.tsx` | (yeni) |
| `remotion/src/Root.tsx` | ikinci `<Composition id="Comments">` |
| `remotion/public/gameplay/README.md` | (yeni) |
| `docs/SECRETS.md` | yeni secret'lar |

---

## 9. Kapsam Dışı (YAGNI)

- Otomatik gameplay klip indirme (kullanıcı klasörü doldurur; boşsa stok).
- Çoklu dil / çeviri.
- Reddit OAuth (public JSON yeterli).
- Otomatik zamanlama.
- Yorumlara gerçek avatar görselleri (jenerik renkli avatar dairesi yeterli).

---

## 10. Başarı Kriterleri

1. `gh workflow run produce.yml -f mode=comments` insan müdahalesiz: Reddit'ten soru+yorum çeker, küratörler, TTS'ler, arka plan + yorum kartlarıyla render eder, **2. kanala private** yükler.
2. Yorumlar güvenli (NSFW/küfür/kişisel-bilgi elenmiş), kendi başına anlaşılır, gerçekten komik seçki.
3. Video: soru kartı üstte sabit, yorum kartları TTS'e senkron tek tek belirir, read-along vurgu, arka plan blur+dim, EndCard + CTA.
4. < 60 saniye; müzik düşük, voiceover baskın, SFX kart girişinde.
5. `facts` mode hiç bozulmadan çalışmaya devam eder (paylaşılan aşamalar geriye-uyumlu).
6. `npm test` (yeni saf birimler: reddit parse, buildSegments, parseUpvotes, curate parse) yeşil; render CI'da başarılı.
7. İki kanal birbirinden bağımsız dedup/history.
