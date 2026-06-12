# remo — "Money & Finance Psychology" Mode Tasarımı

**Tarih:** 2026-06-12
**Durum:** Tasarım onaylandı
**Bağlam:** İkinci kanal (Fun Honey) için içerik konsepti "komik yorumlar"dan **para & finans psikolojisi**ne değiştirildi (kullanıcı kararı). Mevcut "anlatımlı açıklayıcı" motoru (DustMust'ın `facts` modu) yeniden kullanılır; içerik para-odaklı olur ve finansa-özel görsel bileşenler (sayı sayacı, yükselen grafik, yeşil/altın tema) eklenir. `comments` modu kodda dormant kalır.

---

## 1. Amaç

40-50sn İngilizce, para psikolojisi odaklı (karışık açı: para psikolojisi / zengin-fakir zihniyet / günlük para kuralı) Shorts üretmek; büyük animasyonlu sayı sayaçları + yükselen grafikler + para footage ile; Fun Honey kanalına private yüklemek.

- **Dil:** İngilizce. **Açı:** karışık (LLM her video için seçer). **Görsel:** finansa-özel. **Kanal:** Fun Honey (token hazır: `YT_COMMENTS_REFRESH_TOKEN`).
- **Güvenlik:** finansal TAVSİYE değil — eğitim/eğlence tonu + kısa disclaimer (LLM talimatı + açıklamaya not).

---

## 2. Mode Anahtarı

- `pipeline/config.js` → `mode: "facts" | "comments" | "money"` (env `MODE`; varsayılan `facts`).
- `pipeline/run.js` `money` dalı: `01m-topic → 02m-script → 03-voiceover (paylaşılan synthSegments) → 05-media (para footage) → 05c-annotate (opsiyonel) → 06-render(Money) → upload(Fun Honey)`.
- `comments` modu dokunulmaz (dormant). `facts` geriye-uyumlu kalır.

---

## 3. İçerik Hattı

### 3.1 `01m-topic` (OpenRouter)
- Girdi: Fun Honey'in `state/history.json` `mode:"money"` kayıtları (dedup).
- Prompt: para/finans **psikolojisi** konusu seç (karışık açı). Çıktı `topic.json`: `{ topic, angle, why_interesting, slug }`. (facts'taki şemayla aynı; sadece domain farklı.)

### 3.2 `02m-script` (OpenRouter)
- 40-50sn İngilizce senaryo, 5-6 sahne, kancalı yapı (hook_question / wait_teaser / payoff / cta — facts ile aynı).
- Her sahne EK alanlar (opsiyonel):
  - `stat`: vurgulanacak anahtar sayı → `{ value: "$1,000,000", label: "by retirement" }` veya null
  - `chart`: yükselen trend verisi → `[10, 25, 18, 60, 100]` (3-6 nokta) veya null
  - `emoji`, `on_screen_text`, `annotate`, `visual_query`/`visual_query_alt` (facts ile aynı; visual_query para/iş odaklı)
- **Disclaimer:** description'a "Educational/entertainment only, not financial advice." eklenir (curate veya 06-render meta'ya).
- Çıktı: `scenes.json` (her sahne stat/chart taşır) + `meta.json` (#shorts #money #finance #investing).

### 3.3 Paylaşılan aşamalar
- `03-voiceover` (synthSegments), kelime sınırları → captions.json. `05-media` para footage indirir. `05c-annotate` opsiyonel. Hepsi mevcut, mode-agnostik.

---

## 4. Remotion `Money` Kompozisyonu

`remotion/src/Money.tsx` — `Short` ile aynı altyapı + finans bileşenleri. Tema accent yeşil/altın.

### 4.1 Yeniden kullanılan bileşenler
`Scene` (footage + Ken Burns + giriş geçişi), `KineticCaptions`, `HookCard`, `EndCard` (money CTA), `OnScreenText`, `EmojiPop`, `Annotation` (opsiyonel), `ProgressBar`.

### 4.2 Yeni finans bileşenleri
- **`NumberCounter`** ({ value, label, accentColor }): `value` string'inden sayı parse edilir; 0'dan hedefe **sayar** (ease-out), büyük kalın, prefix/suffix korunur ($/%/k/m), `spring` pop + 💰. Sahnenin `stat`'ı varsa o sahnede gösterilir.
- **`MiniChart`** ({ points, accentColor }): normalize edilmiş `points` bir SVG **çizgi grafiği** olarak **çizilircesine** belirir (`drawProgress`/`dashOffsetFor` yeniden kullanılır), son noktada yeşil ↗ ok + parlama. Sahnenin `chart`'ı varsa gösterilir.
- **`TickerStrip`** ({ accentColor }): üstte ince, yavaş kayan dekoratif borsa şeridi (jenerik semboller + yeşil/kırmızı renkler, ±%). Atmosfer; gerçek veri yok.

### 4.3 Veri akışı (inputProps — `buildMoneyProps`)
`buildInputProps`'a paralel; ek olarak her sahne `stat` (`{value,label}|null`) ve `chart` (`number[]|null`) taşır. Üst düzey hook/payoff/cta/emoji/annotation/sfx/music aynı.
```json
{ "...": "(buildInputProps ile aynı alanlar)",
  "scenes": [ { "...": "...", "stat": {"value":"$1,000,000","label":"by 65"} | null, "chart": [10,25,18,60,100] | null } ] }
```

### 4.4 Saf yardımcılar (`anim.ts`, test edilir)
- `countValue(targetNum, p)` → 0..1 ilerlemede sayı (ease-out).
- `parseStat("$1.2M")` → `{ prefix:"$", num:1200000, suffix:"" }` (veya benzeri ayrıştırma).
- `chartPath(points, w, h)` → normalize SVG path string.
- Mevcut `drawProgress`, `dashOffsetFor`, `popScale`, `boxToScreen` yeniden kullanılır.

### 4.5 Tema
`config.niches.money`: accent paleti `["#16C784", "#F0B90B", "#2EBD85", "#FFD700"]` (yeşil/altın), channelName `@FunHoney`.

---

## 5. Kanal & Upload (yeni yetkilendirme YOK)

- Fun Honey token'ı `YT_COMMENTS_REFRESH_TOKEN` (mevcut). `money` mode bunu kullanır.
- Token seçimi: `facts → YOUTUBE_REFRESH_TOKEN`, `comments|money → YT_COMMENTS_REFRESH_TOKEN`.
- `produce.yml` upload adımı: `if mode == facts → YOUTUBE else → YT_COMMENTS`. `publish.yml channel` seçici aynı mantıkla (money onayları Fun Honey).

---

## 6. CI

- `produce.yml -f mode=money` → para videosu, Fun Honey'e private upload. Yeni secret gerekmez.
- `MODE` env zaten geçiliyor. Upload token seçimi mode'a göre güncellenir (facts dışındakiler Fun Honey).

---

## 7. Etkilenen / Yeni Dosyalar

| Dosya | Değişiklik |
|---|---|
| `pipeline/config.js` | `mode` (money dahil), `niches.money` (accent/channelName/domain) |
| `pipeline/01m-topic.js` | (yeni) para konusu seçimi |
| `pipeline/02m-script.js` | (yeni) para senaryosu + stat/chart + disclaimer |
| `pipeline/lib/timeline.js` | `buildMoneyProps` (scene stat/chart) |
| `pipeline/06-render.js` | money branch: `prepareMoneyRender` + `renderMoney` (kompozisyon id "Money") |
| `pipeline/run.js` | money mode dallanması + Fun Honey token |
| `remotion/src/schema.ts` | `moneySchema` (scene stat/chart) |
| `remotion/src/lib/anim.ts` | `countValue`, `parseStat`, `chartPath` |
| `remotion/src/components/NumberCounter.tsx` | (yeni) |
| `remotion/src/components/MiniChart.tsx` | (yeni) |
| `remotion/src/components/TickerStrip.tsx` | (yeni) |
| `remotion/src/Money.tsx` | (yeni) kompozisyon |
| `remotion/src/Root.tsx` | üçüncü `<Composition id="Money">` |
| `.github/workflows/produce.yml` | upload token: facts→DustMust, diğer→Fun Honey |
| `.github/workflows/publish.yml` | (zaten channel seçici var; doğrula) |

---

## 8. Kapsam Dışı (YAGNI)

- Gerçek borsa/piyasa verisi API'si (ticker dekoratif, sahte semboller).
- Yeni kanal OAuth (Fun Honey hazır).
- `comments` modunu silmek (dormant bırakılır).
- Gerçek finansal tavsiye / kişiselleştirilmiş öneri (sadece eğitim + disclaimer).
- Çoklu dil.

---

## 9. Başarı Kriterleri

1. `gh workflow run produce.yml -f mode=money` insan müdahalesiz: para konusu → senaryo (stat/chart'lı) → TTS → para footage → render → Fun Honey'e private upload.
2. Video: kancalı yapı + en az 1 sahnede büyük **animasyonlu sayı sayacı**, en az 1 sahnede **yükselen grafik**, dekoratif ticker, yeşil/altın tema, kelime-senkron altyazı, EndCard money CTA.
3. Açıklamada "not financial advice" disclaimer'ı bulunur.
4. < 60 saniye; müzik düşük, voiceover baskın.
5. `facts` (DustMust) ve `comments` modları bozulmadan kalır.
6. `npm test` (yeni saf birimler: countValue, parseStat, chartPath, buildMoneyProps, money script persist) yeşil; render CI'da başarılı.
7. Fun Honey kendi konu dedup'ını ayrı izler.
