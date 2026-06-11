# remo — Görsel/Ses Yükseltmesi (Viral Kinetik) Tasarımı

**Tarih:** 2026-06-11
**Durum:** Tasarım onaylandı
**Bağlam:** İlk üretilen short'tan sonra kullanıcı geri bildirimi: (1) aynı stok görsel/video tekrar ediyor, (2) video çok sade — efektli, animasyonlu, dikkat çekici olsun. Bu spec, `2026-06-11-remo-shorts-factory-design.md`'deki **sade animasyon** kararını bilinçli olarak tersine çevirir.

---

## 1. Amaç

İki problemi çözmek:
1. **Medya tekrarı (hata):** Stok seçici her sorgu için ilk sonucu alıyor; benzer sahne sorguları aynı klibe düşüyor.
2. **Sadelik (tasarım değişikliği):** "Viral/kinetik" bir görsel-işitsel dil — zıplayan altyazılar, punchy geçişler, foto üzerine motion graphics, arka plan müziği.

**Görsel temel:** Akıllı karışım — önce konuya uygun stok **video**, bulunamazsa stok **fotoğraf + yoğun Remotion motion graphics**.
**Stil:** Viral / kinetik (MrBeast/TikTok tonunda). `spring()` ve `@remotion/transitions` artık serbest.

---

## 2. Medya Tekrarını Çözme

### 2.1 Aday havuzu + run-içi tekrar engelleme
- Sağlayıcı fetcher'ları (pexels/pixabay/unsplash) tek sonuç yerine **aday listesi** döndürür: `[{ type, url, id }]` (ilk 5).
- Yeni `findMediaCandidates(query, order, providers)` → sağlayıcı sırasına göre adayları birleştirip döndürür (her adaya `provider` eklenir).
- `05-media`, run boyunca kullanılan medyaların anahtarlarını (`provider:id` veya `url`) bir `used` Set'inde tutar. Her sahne için adaylardan **henüz kullanılmamış** ilkini seçer. Tüm adaylar kullanıldıysa son adaya düşer (ama log'lar).
- Sonuç: bir video içinde aynı klip/foto iki kez görünmez.

### 2.2 Daha ayrık, spesifik sorgular
- `02-script` prompt'u, her sahne için **birbirinden belirgin farklı ve somut** `visual_query` üretir; ayrıca sahne başına bir **yedek sorgu** (`visual_query_alt`) verir. `05-media`, ana sorgu tükenirse/duplike olursa yedek sorguyla yeniden arar.
- Şema: `scenes[].visual_query` (var), `scenes[].visual_query_alt` (yeni, opsiyonel).

### 2.3 Akıllı karışım (video öncelikli)
- `05-media` her sahne için **önce video** sağlayıcılarını (pexels videos → pixabay videos) dener; aday yoksa **foto** sağlayıcılarına (pixabay photo → unsplash) düşer.
- `media.json` her sahnenin `type`'ını (`video|image`) taşır (var). Foto sahnelerinde Remotion daha yoğun animasyon uygular (§3.5).

### 2.4 Videodan-videoya çeşitlilik
- Her run, `runId`'den türetilen deterministik bir tohumla **vurgu rengini** (palet dizisinden) ve **kinetik varyantı** seçer (`seededVariant`). Ardışık videolar tek tip görünmez.

---

## 3. Viral / Kinetik Animasyon Paketi (Remotion)

Tüm hareket `useCurrentFrame()` + `interpolate()` + `spring()` ile. CSS transition/animation ve Tailwind animasyon sınıfları hâlâ YASAK.

### 3.1 Kinetik altyazılar (`KineticCaptions`, mevcut `Captions` yükseltmesi)
- Aktif (konuşulan) kelime `spring()` ile **pop** yapar: scale 0.6→1.15→1.0, hafif yukarı sıçrama (translateY).
- Aktif kelime **vurgu renginde**; geçmiş kelimeler küçülüp soluklaşır (opacity 0.5, scale 0.9).
- Aktif kelimenin arkasında **vurgu kutusu** (accent renkli, hafif yuvarlatılmış) `spring()` ile genişleyerek belirir.
- Kalın outline (WebkitTextStroke) korunur; font Anton.

### 3.2 Sahne geçişleri (`@remotion/transitions`)
- `Short.tsx`, `Sequence` yerine **`TransitionSeries`** kullanır.
- Sahneler arası **6–10 frame** hızlı geçiş; varyant (`slide` / `wipe` / `clockWipe` / `fade`) `seededVariant` + sahne index'ine göre değişir.
- Geçiş süresi sahne süresinden düşülerek toplam süre korunur (`TransitionSeries.Transition` + `linearTiming`).

### 3.3 Zoom-punch giriş
- Her sahne hafif zoomlu başlar (scale 1.12) ve `spring()` ile 1.0'a **oturur**; sahne başında kısa bir scale-pulse → "vurgu" hissi. (Mevcut lineer Ken Burns'ün yerini alır; foto sahnelerinde Ken Burns + parallax birlikte.)

### 3.4 Animasyonlu hook/başlık kartı (`TitleCard`)
- 1. sahnede (hook) büyük kalın başlık **kelime kelime reveal** (staggered: her kelime sırayla `spring()` pop) + accent vurgu. Kısa süre sonra fade-out.

### 3.5 Foto sahneleri için motion background (`MotionBackground`)
- Parallax zoom (arka plan foto yavaş hareket) + yavaş kayan **gradient/vignette** + ekranda süzülen **accent geometrik şekiller** (daire/çizgi, düşük opaklık). Statik foto bile canlı görünür.
- Yalnızca `media.type === "image"` sahnelerde devreye girer.

### 3.6 Süsler
- Köşede animasyonlu kanal etiketi (`@channel`), kalın stilize **ilerleme çubuğu** (mevcut `ProgressBar` yükseltmesi: accent renk + hafif glow).
- (Opsiyonel/hafif) anahtar kelimelerde ikon/emoji pop — ilk sürümde kapalı, sonra eklenebilir.

### 3.7 Saf yardımcılar (`anim.ts`, `node:test` ile test edilir)
- `popScale(frame, fps, { from, to, overshoot })` — spring tabanlı pop eğrisi.
- `punchZoom(frame, fps, durationFrames)` — giriş zoom-punch scale değeri.
- `staggerReveal(index, frame, fps, perItemFrames)` — kelime kelime reveal için 0..1 ilerleme.
- `seededVariant(seed, count)` — `runId` string'inden deterministik 0..count-1 indeks.
- `pickAccent(seed, palette)` — tohumdan vurgu rengi.
- Mevcut `kenBurnsScale`, `fadeOpacity`, `activeCaptionIndex` korunur.

---

## 4. Arka Plan Müziği

- **Kaynak:** `remotion/public/music/` klasörüne konan royalty-free `.mp3` parçalar (kullanıcı ekler; CI'da commit'li gelir). Bu klasör `.gitignore`'dan **muaf** tutulur (içindeki `.mp3`'ler commit'lenir).
- **Seçim:** Yeni `pipeline/05b-music.js` (veya `05-media` içinde) `runId` tohumuyla klasörden bir parça seçer, `remotion/public/<id>/music.mp3`'e kopyalar ve `media.json`/ayrı `music.json`'a yazar. Klasör boşsa **müzik atlanır** (graceful; video yine render olur, `hasMusic:false`).
- **Render:** `Short.tsx` müzik varsa `<Audio src={music} ... />` ekler; ses seslendirmenin **altında** (`volume ≈ 0.10`), video boyunca **loop**, başta/sonda **fade in/out** (15 frame).
- **Lisans notu:** Kullanıcı yalnızca hakkına sahip olduğu/royalty-free parçaları ekler (README + docs'a not).

---

## 5. Etkilenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `pipeline/lib/providers.js` | her sağlayıcıya `*Candidates` (liste döndüren) varyant; video/foto ayrımı |
| `pipeline/lib/stock.js` | `findMediaCandidates` (liste + provider etiketli) |
| `pipeline/05-media.js` | aday havuzu + `used` dedup + video-öncelikli karışım + yedek sorgu |
| `pipeline/05b-music.js` | (yeni) müzik seçimi + kopyalama |
| `pipeline/02-script.js` | prompt: ayrık `visual_query` + `visual_query_alt` |
| `pipeline/run.js` | müzik aşamasını çağır; tohumu (runId) ilet |
| `pipeline/lib/timeline.js` | `buildInputProps`: `theme.accentColor` tohumdan; `musicSrc`, `hasMusic`; geçiş varyantı |
| `remotion/src/lib/anim.ts` | yeni saf yardımcılar (§3.7) |
| `remotion/src/schema.ts` | `musicSrc`, `hasMusic`, sahne `mediaType`, varyant alanları |
| `remotion/src/components/KineticCaptions.tsx` | (yeni) kinetik altyazı |
| `remotion/src/components/TitleCard.tsx` | (yeni) hook başlık |
| `remotion/src/components/MotionBackground.tsx` | (yeni) foto motion graphics |
| `remotion/src/components/Scene.tsx` | zoom-punch + foto/ video varyant |
| `remotion/src/components/ProgressBar.tsx` | stilize |
| `remotion/src/Short.tsx` | `TransitionSeries` + müzik `<Audio>` + KineticCaptions/TitleCard |
| `remotion/src/Root.tsx` | süre hesabı geçiş sürelerini hesaba katar |
| `remotion/package.json` | `@remotion/transitions` bağımlılığı |
| `.gitignore` | `remotion/public/music/` muafiyeti |
| `pipeline/config.js` | `music`, `accentPalette`, `transition` ayarları |

---

## 6. Kapsam Dışı (YAGNI)

- Ses efektleri (whoosh/pop) — sonra eklenebilir.
- AI görsel üretimi (stok yeterli).
- Beat-senkron animasyon (müziğe göre kesme) — sonra.

---

## 7. Başarı Kriterleri

1. Bir video içinde **hiçbir stok klip/foto iki kez** görünmez (run-içi dedup).
2. Sahne sorguları belirgin farklı → görseller konuyla daha alakalı ve çeşitli.
3. Altyazılar kelime kelime **pop/scale** ile animasyonlu; sahneler arası **punchy geçiş** var; foto sahneleri **motion background** ile canlı.
4. Her video, `runId` tohumuna göre farklı vurgu rengi/varyant → tek tip değil.
5. `remotion/public/music/` doluysa arka plan müziği düşük seste çalar; boşsa video müziksiz ama hatasız render olur.
6. `npm test` (pipeline saf yardımcıları) ve `remotion` `anim.ts` testleri yeşil; render CI'da başarılı.
7. Tüm hareket `useCurrentFrame`/`interpolate`/`spring` ile; CSS/Tailwind animasyonu yok.
