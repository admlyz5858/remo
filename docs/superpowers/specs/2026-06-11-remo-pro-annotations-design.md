# remo — Pro İçerik & AI-Vision Anotasyon Tasarımı (v3)

**Tarih:** 2026-06-11
**Durum:** Tasarım onaylandı
**Bağlam:** Kullanıcı, "Club Kodex" tarzı (gerçek footage + temiz kalın altyazı + işaret okları/daireleri + SFX) profesyonel bir his istedi. Maksimalist partikül yönü, kullanıcı tercihiyle **harman** yöne revize edildi. Bu spec, `2026-06-11-remo-visual-upgrade-design.md`'nin üzerine içerik kancaları, harman görseller, **AI-vision ile nesne işaretleme**, çizilen ok/daire anotasyonları ve ses efektleri ekler.

---

## 1. Amaç

Üretilen Shorts'u "amatör stok montaj"dan "profesyonel açıklayıcı"ya taşımak:
1. **İçerik kancaları:** baştan tahmin sorusu, ortada "wait for it", sonda payoff + izleyici etkileşimi (yorum-bait + takip).
2. **Harman görsel:** daha alakalı footage + temiz kalın altyazı + etkileşim kartları + ölçülü emoji (partikül yağmuru YOK).
3. **AI-vision anotasyon:** Gemini Vision ile her önemli sahnede anlatılan nesnenin yeri bulunur; üzerine **çizilen kırmızı ok/daire** + etiket gelir.
4. **SFX:** anotasyon çizilirken senkron whoosh/scribble sesi.

Stil referansı: temiz, içerik-odaklı, dikkat çekici — kaotik değil.

---

## 2. İçerik & Yapı (Stage 02 — script)

LLM artık şu kancalı yapıyı üretir; sözlü versiyonlar sahne narration'larına gömülür (senkron için):

```
[1. sahne]   narration = Hook + tahmin sorusu      → HookCard overlay
[orta sahne] narration içinde "wait for it" köprüsü → WaitBadge overlay
[içerik]     3-5 sahne                              → her sahnede emoji + anahtar kelime
[son sahne]  narration = Payoff + CTA               → EndCard overlay
```

**scenes.json yeni alanlar:**
- Üst düzey: `hook_question` (kısa), `wait_teaser` (kısa), `payoff` (kısa), `cta` (kısa, yorum-bait + takip)
- `scenes[].emoji` (1 ilgili emoji veya null)
- `scenes[].annotate` (boolean — LLM en görsel/önemli 1-2 sahneyi işaretler)
- `scenes[].visual_query` daha spesifik çekim tarifi (referansa yakın footage için prompt güçlendirilir)

LLM kuralları: hook scene 1 narration'ını açar; payoff+CTA son sahne narration'ını kapatır; `annotate=true` yalnızca somut bir nesnenin gösterilebileceği 1-2 sahnede.

---

## 3. AI-Vision Anotasyon (Yeni Stage 05c)

**`pipeline/05c-annotate.js`** — stage 05 (medya) sonrası, stage 06 (render) öncesi.

Akış (yalnızca `annotate=true` sahneler için):
1. İnen medyadan temsilci kare çıkar: `ffmpeg -ss <orta> -i <media> -frames:v 1 frame.jpg` (video) veya görseli doğrudan kullan.
2. Kareyi `pipeline/lib/vision.js` ile **Gemini Vision**'a gönder (model: `gemini-2.0-flash`, `GEMINI_API_KEY`):
   - Prompt: "Narration: '<narration>'. Highlight the main subject roughly described as '<visual_query>'. Return ONLY JSON: {box:{x,y,w,h}, label} with normalized 0-1 coords. If unclear, box={x:0.5,y:0.5,w:0,h:0}."
3. `box` doğrula/clamp (0-1). Geçersiz/başarısızsa **merkez** (`{x:0.5,y:0.45,w:0,h:0}`) — render asla bozulmaz.
4. Anotasyon tipi seed'le seçilir: `arrow` | `circle`.
5. Çıktı `run/<id>/annotations.json`: `[{ sceneId, box:{x,y,w,h}, label, type }]`.

**Güvenilirlik/kalite:** Sahne başına en fazla 1 anotasyon; video başına ~1-2. Vision çağrısı best-effort; hata tüm aşamayı durdurmaz (sahneyi anotasyonsuz geçer).

**`pipeline/lib/vision.js`:** `detectSubject({ apiKey, imageBase64, narration, query, fetchImpl })` → `{box, label}`. `fetchImpl` enjekte edilebilir (test). Gemini `generateContent` REST endpoint'i inline base64 görselle.

---

## 4. Görsel Katman (Remotion) — Harman

Tüm hareket `useCurrentFrame`/`interpolate`/`spring` + saf eğri yardımcıları. CSS/Tailwind animasyon YASAK.

### 4.1 Etkileşim kartları
- **`HookCard`** (1. sahne): büyük tahmin sorusu, kelime-kelime reveal + "🤔 GUESS?" rozeti, kısa süre sonra fade.
- **`WaitBadge`** (orta sahne): yanıp sönen "WAIT FOR IT 👀" rozeti, hafif sallanma.
- **`EndCard`** (son sahne): payoff metni + "💬 Comment <emoji>" + animasyonlu **takip butonu** (pulse) + `@channel`.

### 4.2 Çizilen anotasyon (referans imzası)
- **`Annotation`** bileşeni: `scene.annotation` varsa, `box` koordinatına göre **kırmızı ok** veya **daire** SVG olarak **çiziliyormuş gibi** belirir (stroke-dashoffset animasyonu, ~7 frame), yanında küçük etiket kutusu.
- Ok, `box` merkezine dışarıdan işaret eder; daire `box`'ı çevreler (genişlik/yükseklik 0 ise sabit yarıçap).
- Çizim başında **SFX** tetiklenir (§4.4).

### 4.3 Diğer
- **`EmojiPop`**: sahnenin emojisi `spring` ile patlar, hafif süzülür (ölçülü).
- **`KineticCaptions`**: sadeleştirilmiş — temiz kalın beyaz, aktif kelimede hafif pop + accent kutu + okunur gölge (referans tarzı).
- **`Scene`**: sıkı giriş geçişleri (slide/zoom/fade) + zoom-punch; **partikül yok**; fotoğraf sahnelerinde hafif `MotionBackground` kalır.
- **`ProgressBar`**: stilize (mevcut).
- Her video tohumla farklı accent rengi (mevcut).

### 4.4 Ses efektleri
- `remotion/public/sfx/` altına royalty-free `.mp3` SFX (whoosh/scribble/pop). `.gitignore` muafiyeti.
- Render'da her anotasyon için, çizim başladığı frame'de `<Audio src={staticFile(sfxSrc)} ... />` çalar (kısa). SFX dosyası seed'le seçilir (`sfxSrc`).
- Katmanlar: voiceover (tam) + müzik (düşük, loop) + SFX (anlık).

---

## 5. Veri Akışı (inputProps eklenenler)

`buildInputProps` çıktısına eklenir:
```json
{ "hookQuestion": "string|null",
  "waitTeaser": "string|null",
  "payoff": "string|null",
  "cta": "string|null",
  "sfxSrc": "<run-id>/sfx.mp3 | null",
  "scenes": [ { "...": "...",
    "emoji": "string|null",
    "annotation": { "box": {"x":0,"y":0,"w":0,"h":0}, "label": "string", "type": "arrow|circle" } | null } ] }
```
- `annotation`, `annotations.json`'dan sahne id eşleştirilerek bağlanır.
- `sfxSrc`: stage 06 `remotion/public/sfx/`'ten seed'le bir SFX seçip `public/<id>/sfx.mp3`'e kopyalar (müzikteki gibi). Boşsa null → anotasyon sessiz çizilir.

---

## 6. Saf Yardımcılar (`remotion/src/lib/anim.ts`, test edilir)

- `drawProgress(frame, startFrame, frames)` → 0..1 (stroke çizim ilerlemesi).
- `dashOffsetFor(length, p)` → `length * (1 - p)` (SVG çizilme).
- `arrowTarget(box)` / `circleGeom(box)` → normalize box'tan ekran koordinatı (px, 1080×1920 baz) hesaplar.
- Mevcut: `popScale`, `punchZoom`, `staggerReveal`, `transitionStyle`, `kenBurnsScale`, `fadeOpacity`, `activeCaptionIndex`.

---

## 7. Etkilenen / Yeni Dosyalar

| Dosya | Değişiklik |
|---|---|
| `pipeline/02-script.js` | prompt: hook/wait/payoff/cta + emoji + annotate + spesifik query |
| `pipeline/lib/vision.js` | (yeni) Gemini Vision `detectSubject` |
| `pipeline/05c-annotate.js` | (yeni) kare çıkar → vision → annotations.json |
| `pipeline/lib/frame.js` | (yeni) ffmpeg ile medyadan temsilci kare çıkarma |
| `pipeline/06-render.js` | annotations + sfx seçimi; props'a yeni alanlar |
| `pipeline/lib/timeline.js` | `buildInputProps`: hook/wait/payoff/cta/emoji/annotation/sfx |
| `pipeline/run.js` | 05c aşamasını çağır |
| `pipeline/config.js` | `sfx: {dir}`, vision model/ayar |
| `.gitignore` | `remotion/public/sfx/` muafiyeti |
| `remotion/src/schema.ts` | yeni inputProps alanları |
| `remotion/src/lib/anim.ts` | draw/dash/geom yardımcıları |
| `remotion/src/components/HookCard.tsx` | (yeni) |
| `remotion/src/components/WaitBadge.tsx` | (yeni) |
| `remotion/src/components/EndCard.tsx` | (yeni) |
| `remotion/src/components/Annotation.tsx` | (yeni) çizilen ok/daire + etiket |
| `remotion/src/components/EmojiPop.tsx` | (yeni) |
| `remotion/src/components/KineticCaptions.tsx` | sadeleştir (temiz kalın) |
| `remotion/src/components/Scene.tsx` | partikülsüz; geçiş + zoom-punch korunur |
| `remotion/src/Short.tsx` | tüm yeni bileşenleri + SFX `<Audio>` orkestrasyonu |
| `remotion/public/sfx/README.md` | royalty-free SFX nasıl eklenir |

---

## 8. Kapsam Dışı (YAGNI)

- Konuşan-kafa (talking head) klipleri — stok footage ile değil.
- Beat-senkron kesme (müziğe göre).
- Partikül sistemleri / sürekli motion-graphics.
- Çoklu anotasyon/sahne (1/sahne ile sınırlı).
- Footage içi nesne *takibi* (yalnızca tek-kare tespit; nesne hareket ederse ok sabit kalır).

---

## 9. Başarı Kriterleri

1. Video başında tahmin sorusu (HookCard), ortada "wait for it" (WaitBadge), sonda payoff + yorum-bait + takip (EndCard) görünür ve **seslendirmeyle senkron**.
2. En önemli 1-2 sahnede, anlatılan nesnenin **üzerine/yakınına** çizilen kırmızı ok/daire + etiket gelir; çizim anında SFX çalar.
3. Altyazı temiz, kalın, okunur (referans tarzı); partikül yok.
4. Footage sahne konularına daha alakalı (spesifik query); video-öncelikli.
5. Vision başarısız olursa anotasyon merkeze düşer veya atlanır; **render asla bozulmaz**.
6. `npm test` (pipeline saf birimler: vision parse, timeline, frame helper, anim) yeşil; render CI'da başarılı.
7. Her video tohumla farklı accent + SFX/anotasyon tipi.
8. Müzik + SFX + voiceover katmanları dengeli (voiceover baskın, müzik düşük, SFX anlık).
