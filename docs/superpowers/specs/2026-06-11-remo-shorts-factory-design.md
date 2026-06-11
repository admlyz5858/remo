# remo — İngilizce "Fun Facts" Shorts Fabrikası

**Tarih:** 2026-06-11
**Durum:** Tasarım onaylandı, implementasyon planı bekleniyor
**Konum:** `/storage/emulated/0/dos/remo`

---

## 1. Özet

Telefondan tek komutla ("yeni short üret") tetiklenen, GitHub Actions üzerinde
çalışan, uçtan uca otomatik bir YouTube Shorts üretim hattı.

Hat: ilginç bir bilgi bulur → İngilizce 40-50 saniyelik senaryo yazar →
Edge TTS ile seslendirir → stok video indirir → **Remotion ile** altyazı,
animasyon ve grafiklerle render eder → YouTube'a **private** yükler. Kullanıcı
onaylayınca video public olur, reddederse silinir.

**Niş:** İlginç bilgiler / genel kültür (evergreen)
**Dil:** İngilizce
**Format:** YouTube Shorts — 1080×1920 dikey, 30fps, < 60 saniye

---

## 2. Bağımsızlık ve Yeniden Kullanım

Bu proje `/storage/emulated/0/dos/otomasyon` sistemine **hiç dokunmaz**. otomasyon
ayrı bir Türkçe/gezi/FFmpeg sistemidir ve çalışır durumda kalır.

remo, otomasyon'dan yalnızca iki şey ödünç alır:

1. **API anahtarları** — `otomasyon/.env`'den kopyalanır (GitHub Secrets'a girilir).
2. **Kanıtlanmış Python script'lerinin sadeleştirilmiş kopyaları** — TTS, stok
   arama, YouTube upload, transcribe. Bunlar referans alınıp remo'ya temiz
   kopyalanır; otomasyon'daki orijinaller değişmez.

**Onay mekanizması = Claude (ben).** Ayrı Telegram botu yok. Kullanıcı telefondan
bana komut verir, ben `gh workflow run` ile tetiklerim ve sonucu raporlarım.

---

## 3. Mimari ve Depo Yapısı

```
remo/                              (GitHub reposu)
├── .github/workflows/
│   ├── produce.yml                # Üretim hattı (workflow_dispatch ile tetiklenir)
│   └── publish.yml                # Onay sonrası: private→public veya sil
├── pipeline/                      # Node.js/TypeScript orkestratör
│   ├── run.js                     # 01→06 aşamalarını sırayla çalıştırır
│   ├── 01-topic.js                # OpenRouter: konu seç
│   ├── 02-script.js               # OpenRouter: senaryo + meta
│   ├── 03-voiceover.js            # Edge TTS çağırır (python script)
│   ├── 04-captions.js             # Whisper transcribe çağırır
│   ├── 05-media.js                # Pexels→Pixabay→Unsplash stok indir
│   ├── 06-render.js               # Remotion programatik render
│   └── lib/
│       ├── openrouter.js          # OpenRouter istemcisi
│       ├── history.js             # state/history.json oku/yaz
│       └── stock.js               # 3 stok sağlayıcı istemcisi
├── scripts/                       # otomasyon'dan kopyalanan Python script'leri
│   ├── tts.py                     # Edge TTS (+ ElevenLabs fallback)
│   ├── transcribe.py              # Whisper kelime-düzeyli zamanlama
│   └── upload_youtube.py          # YouTube Data API yükleme + privacy değiştirme
├── remotion/                      # Remotion projesi
│   └── src/
│       ├── Root.tsx               # Composition + calculateMetadata
│       ├── Short.tsx              # Ana kompozisyon
│       ├── components/
│       │   ├── Scene.tsx
│       │   ├── Captions.tsx
│       │   ├── OnScreenText.tsx
│       │   └── ProgressBar.tsx
│       └── schema.ts              # Zod inputProps tipleri
├── public/<run-id>/               # İnen stok medya (staticFile referansı)
├── state/
│   └── history.json               # Üretilmiş konular + video durumları
├── run/<run-id>/                  # Aşama çıktıları (topic.json, scenes.json, ...)
├── out/<run-id>.mp4               # Render edilmiş video
└── docs/superpowers/specs/        # Bu spec
```

### Veri akışı

Her aşama bir JSON üretir, sonraki onu okur. Tek `run/<id>/` klasöründe birikir.
Aşamalar bağımsız test edilebilir; hata olursa kaldığı yerden devam edilebilir.

```
01-topic     → topic.json   { topic, angle, why_interesting }
02-script    → scenes.json  { scenes:[{id, narration, visual_query, on_screen_text}],
                              hook, cta }
             → meta.json    { title, description, tags }
03-voiceover → audio/voiceover.mp3
             → scenes.json güncellenir (duration_sec, audio_start_ms, audio_end_ms)
04-captions  → captions.json  (@remotion/captions token formatı, kelime-düzeyli)
05-media     → public/<id>/scene_NN.mp4|jpg
06-render    → out/<id>.mp4   (1080×1920, 30fps, h264)
07-upload    → upload.json    { video_id, url } + state/history.json'a commit
```

---

## 4. Hat Aşamaları (Detay)

### 01 — Topic (Konu)
- **Girdi:** `state/history.json` (geçmiş konular + reddedilenler)
- OpenRouter'a prompt: "Geçmişte şunları yaptık [...]. Bunlardan farklı, viral
  potansiyelli, stok görselle eşleştirilebilir yeni bir ilginç bilgi seç."
- **Çıktı:** `run/<id>/topic.json` → `{ topic, angle, why_interesting }`
- İlk sürümde basit tutulur. otomasyon'daki 5-kaynaklı `trend_scout.py` ağır
  sistemi DAHİL EDİLMEZ (YAGNI); ileride eklenebilir.

### 02 — Script (Senaryo)
- **Girdi:** `topic.json`
- OpenRouter'a prompt: 40-50 saniyelik İngilizce senaryo, sahne sahne. Her sahne:
  - `id`, `narration` (TTS-dostu İngilizce), `visual_query` (2-4 İngilizce kelime,
    stok arama için), `on_screen_text` (opsiyonel, ekranda gösterilecek kısa metin)
  - `hook` (ilk 3 saniye kancası), `cta` (son çağrı)
- **Çıktı:** `run/<id>/scenes.json` + `run/<id>/meta.json` (title 60-70 karakter,
  description, tags 15-25 etiket, `#shorts` dahil)

### 03 — Voiceover (Seslendirme)
- **Girdi:** `scenes.json`
- `scripts/tts.py` ile Edge TTS (örn. `en-US-ChristopherNeural` veya
  `en-US-AriaNeural`). Her sahne ayrı render → birleştir → `ffprobe` ile gerçek
  süre ölç.
- TTS soyutlanır: config'te `provider: edge` → ileride `elevenlabs`'e tek satır
  değişiklikle geçilebilir.
- **Çıktı:** `audio/voiceover.mp3` + `scenes.json`'a gerçek süreler yazılır
  (`duration_sec`, `audio_start_ms`, `audio_end_ms`).

### 04 — Captions (Altyazı)
- **Girdi:** `audio/voiceover.mp3`
- `scripts/transcribe.py` (Whisper) ile kelime-düzeyli zamanlama.
- **Çıktı:** `run/<id>/captions.json` — `@remotion/captions` token formatı.

### 05 — Media (Stok Medya)
- **Girdi:** `scenes.json` (her sahnenin `visual_query`'si)
- Her sahne için DİKEY (portrait) stok ara: **Pexels → Pixabay → Unsplash**
  sırasıyla fallback. İlk bulan kazanır.
- Çözünürlük ≥ 1080 genişlik tercih edilir; video yoksa görsel iner.
- **Çıktı:** `public/<id>/scene_NN.mp4|jpg`

### 06 — Render (Remotion)
- **Girdi:** `scenes.json`, `captions.json`, `public/<id>/`, `meta.json`
- Remotion programatik render API. Süre `calculateMetadata` ile ses süresinden
  hesaplanır (frame = ceil(toplam_saniye × 30)).
- **Çıktı:** `out/<id>.mp4` (1080×1920, 30fps, h264)

### 07 — Upload (Yükleme)
- `scripts/upload_youtube.py` ile YouTube'a **PRIVATE** yükle.
- **Çıktı:** `run/<id>/upload.json` → `{ video_id, url }`; `state/history.json`'a
  konu + durum (`pending`) commit edilir.

---

## 5. Remotion Şablonu (Sade Animasyonlar)

**Kompozisyon:** 1080×1920, 30fps, süre = ses süresi (dinamik).

### Katman düzeni (alttan üste)
1. **Stok medya** (full-bleed) — hafif Ken Burns (scale 1→1.08)
2. **Karartma gradyanı** — alt %40 koyu (statik), yazı okunurluğu için
3. **On-screen text** (opsiyonel, üst) — hook/vurgu metni
4. **Altyazı** (alt-orta) — kelime-senkron
5. **Alt bar** — kanal adı + ince ilerleme çizgisi

### Sade animasyon paleti (SADECE bunlar)
| Eleman | Animasyon | Süre |
|---|---|---|
| Sahne girişi | `opacity` 0→1 fade | 8 frame |
| Stok medya | `scale` 1→1.08 linear Ken Burns | sahne boyu |
| On-screen text | `opacity` fade + 20px `translateY` yukarı | 10 frame |
| Altyazı | aktif kelime opak/parlak, diğerleri %60 sönük; pozisyon sabit | — |
| İlerleme çizgisi | alt kenarda `width` 0→100% linear | video boyu |

**Yasak:** Kayma, zıplama, spring, dönme, CSS transition/animation, Tailwind
animasyon sınıfları. Sadece fade + hafif zoom + kelime vurgusu.

### Altyazı stili
Büyük, kalın, ortalı (Anton / Bebas Neue — `@remotion/google-fonts`), beyaz +
kalın siyah outline, aktif kelime sarı. Shorts standart yüksek-retention format.

### Parametrelendirme
Renk (vurgu rengi), font, kanal adı `Root.tsx` `defaultProps`'tan gelir. Zod
şeması (`schema.ts`) inputProps'u doğrular. Yeni "tema" = sadece prop değişikliği.

**Tüm animasyonlar `useCurrentFrame()` + `interpolate()` ile** (Remotion kuralı).

---

## 6. GitHub Actions ve Onay Akışı

### produce.yml (üretim)
`workflow_dispatch` ile tetiklenir (`gh workflow run produce.yml`).
```
ubuntu-latest:
  1. Node + Python kur; npm ci; pip install (edge-tts, requests, openai-whisper,
     google-api-python-client, google-auth-oauthlib)
  2. node pipeline/run.js          → 01→06 (topic→render), out/<id>.mp4
  3. python scripts/upload_youtube.py → YouTube'a PRIVATE yükle
  4. state/history.json commit + push
  5. Özet çıktı: video_id, başlık, açıklama, studio linki
```

### publish.yml (yayınla/reddet)
`gh workflow run publish.yml -f video_id=XXX -f action=approve|reject`
```
  approve → YouTube API: privacyStatus private→public; history "published"
  reject  → YouTube API: video sil; history "rejected"
            (gelecekte LLM'e "bu tür içeriği yapma" sinyali)
```

### GitHub Secrets (otomasyon `.env`'inden)
`OPENROUTER_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_API_KEY`,
`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`

### Kullanıcı deneyimi (telefondan, tek tuş)
```
Kullanıcı: "yeni short üret"
Claude:    gh workflow run produce.yml → izle (~6-8 dk) →
           "✅ Hazır: 'Why Octopuses Have 3 Hearts'
            📺 studio.youtube.com/video/XXX (private)
            Onaylıyor musun?"
Kullanıcı: "onayla" → publish.yml approve → "🎉 Yayında: youtu.be/XXX"
       ya: "beğenmedim" → publish.yml reject + not history'ye
```

Render her zaman önce **private** görülür; kötüyse asla public olmaz.

---

## 7. Maliyet

- **GitHub Actions:** Public repo'da ücretsiz/sınırsız; private'da aylık 2000 dk
  (~8 dk/run → ~250 video/ay).
- **OpenRouter:** Senaryo başına birkaç kuruş (ucuz modeller: deepseek-chat,
  gemini-flash-lite).
- **Edge TTS, stok (Pexels/Pixabay/Unsplash), YouTube:** Ücretsiz.

---

## 8. Kapsam Dışı (YAGNI — ilk sürümde YOK)

- 5-kaynaklı trend tarama (otomasyon `trend_scout.py`)
- Thumbnail üretimi (Shorts'ta thumbnail ikincil; gerekirse sonra)
- Müzik/SFX katmanı
- Analitik öğrenme döngüsü / "gece rüyası"
- Çoklu dil / çoklu kanal
- Web dashboard (kontrol Claude üzerinden)
- ElevenLabs (soyutlama hazır, ama Edge TTS ile başlanır)

---

## 9. Başarı Kriterleri

1. `gh workflow run produce.yml` tek komutu, insan müdahalesi olmadan
   `out/<id>.mp4` üretip YouTube'a private yükler.
2. Üretilen video: 1080×1920, < 60sn, kelime-senkron altyazılı, en az 3 sahne,
   her sahnede ilgili stok medya, izlenebilir İngilizce seslendirme.
3. Animasyonlar Bölüm 5'teki sade paletle sınırlı; CSS/Tailwind animasyon yok.
4. `publish.yml approve` videoyu public yapar; `reject` siler ve history'ye işler.
5. otomasyon sistemi hiç değişmeden çalışmaya devam eder.
6. Konu tekrarı: aynı konu iki kez üretilmez (history kontrolü).
