# remo — Video Fabrikası Dashboard Tasarımı

**Tarih:** 2026-06-13
**Durum:** Tasarım onaylandı
**Bağlam:** remo iki kanallı (DustMust=facts, Fun Honey=money) otomatik video fabrikası. WorldCup dashboard'u (admlyz5858.github.io/worldcup-dashboard) tarzında, iki kanalı tek yerden takip eden + buradan video üretebilen bir dashboard. remo private olduğu için veri public bir dashboard reposuna itilir.

---

## 1. Amaç

Statik bir GitHub Pages dashboard:
1. **Takip:** iki kanalın zamanlı yayın kuyruğu, yayınlananlar, konular, linkler, sayılar + **canlı izlenme/beğeni**.
2. **Kontrol:** dashboard'dan kanal (+ opsiyonel konu) seçip **video üret** → yayın kuyruğuna ekle.
3. **Bağımsız:** tüm üretim GitHub Actions'ta; CLI/Claude'a gerek yok. Kur-ve-unut.

---

## 2. İki Repo Mimarisi

```
remo (PRIVATE) — fabrika + veri yayıncısı
  • .github/workflows/dashboard.yml (yeni): saatlik + produce/publish sonrası
      1. state/history.json oku
      2. YouTube Data API (YOUTUBE_API_KEY secret) → her video için viewCount/likeCount
      3. dashboard.json üret (history + stats)
      4. PUBLIC dashboard reposuna it (DASHBOARD_DEPLOY_TOKEN secret = PAT)
  • produce.yml: opsiyonel `topic` input (boşsa LLM otomatik seçer)

remo-dashboard (PUBLIC, yeni repo) — statik site + GitHub Pages
  • dashboard.json (remo CI günceller)
  • index.html + app.js + style.css
  • admlyz5858.github.io/remo-dashboard/
  • dashboard.json'u okur (aynı origin, anahtarsız), 60sn'de yeniler
  • "Üret" paneli → GitHub API workflow_dispatch (tarayıcıdaki PAT ile)
```

**Sır yönetimi:**
- YouTube anahtarı + DASHBOARD_DEPLOY_TOKEN → remo CI secret'ları (sunucu tarafı).
- Üretim-tetikleme PAT'i → kullanıcının tarayıcısında localStorage (sayfaya/repoya yazılmaz).
- Public sayfada hiçbir sır yok; thumbnail'ler `img.youtube.com/vi/<id>/hqdefault.jpg` (anahtarsız).

---

## 3. Veri Sözleşmesi (`dashboard.json`)

```json
{
  "updated_at": "2026-06-13T10:00:00Z",
  "channels": {
    "facts":  { "name": "DustMust",  "handle": "@DustMust",  "niche": "İlginç bilgiler", "accent": "#FFD400" },
    "money":  { "name": "Fun Honey", "handle": "@FunHoney",  "niche": "Para & finans",   "accent": "#16C784" }
  },
  "videos": [
    { "video_id": "abc", "url": "https://youtu.be/abc", "mode": "facts",
      "topic": "Sloths", "status": "scheduled",
      "publish_at": "2026-06-14T09:00:00Z", "runId": "run-...",
      "views": 0, "likes": 0,
      "thumbnail": "https://img.youtube.com/vi/abc/hqdefault.jpg" }
  ],
  "metrics": { "scheduled": 6, "published": 12, "today": 4, "total_views": 45200 }
}
```
- `mode` → kanal eşlemesi (facts→DustMust, money→FunHoney). `status`: scheduled|published|pending|rejected.
- `views`/`likes`: published videolarda YouTube API'den; diğerlerinde 0.
- `metrics`: özet (CI hesaplar).

---

## 4. remo CI Değişiklikleri

### 4.1 `dashboard.yml` (yeni workflow)
- Tetik: `schedule` (saatlik, `0 * * * *`) + `workflow_run` (produce.yml & publish.yml tamamlanınca).
- Adımlar:
  1. checkout remo.
  2. `node scripts/build_dashboard.js` → `state/history.json` + YouTube `videos.list(part=statistics, id=...)` (YOUTUBE_API_KEY) → `dashboard.json` (kanal meta + videolar + metrics). Thumbnail URL'leri id'den türetilir. Stats çağrısı best-effort (başarısızsa views=0).
  3. dashboard.json'u public repoya it: dashboard repo'yu `DASHBOARD_DEPLOY_TOKEN` ile checkout/clone et, `dashboard.json`'u kopyala, commit + push.

### 4.2 `produce.yml` — opsiyonel `topic` input
- Yeni input `topic` (default ""). Resolve step `TOPIC` env'ine geçirir.
- `run.js` topic aşaması: `TOPIC` doluysa LLM konu seçimini ATLAR, `{topic: TOPIC, angle:"", why_interesting:"", slug: kebab(TOPIC)}` kurar; senaryo aşaması bu konuyu işler. Boşsa mevcut otomatik LLM seçimi.
- `pickTopic`/`pickMoneyTopic` opsiyonel `override` parametresi alır.

### 4.3 `scripts/build_dashboard.js` (yeni)
- Saf-ish: history → dashboard.json dönüşümü test edilebilir bir fonksiyon (`buildDashboard(history, statsById)`); YouTube fetch ayrı (enjekte).

---

## 5. Dashboard Arayüzü (public repo)

Koyu tema, mobil uyumlu, Tailwind CDN, vanilla JS. `dashboard.json`'u fetch eder, 60sn'de yeniler.

### 5.1 Bölümler
- **Başlık:** "🎬 remo · Video Fabrikası" + 🟢/🔴 durum + son güncelleme (`updated_at`).
- **Üretim metrikleri (4 kart):** Zamanlı kuyruk · Bugün üretilen · Toplam yayında · Toplam izlenme.
- **Kanal kartları (2):** ad + niş + video sayısı + toplam izlenme + handle linki, accent renkli.
- **Üret paneli:** kanal radio (DustMust=facts / Fun Honey=money) + **opsiyonel konu kutusu** + "🎬 Üret ve kuyruğa ekle" + ⚙️ token ayarı.
- **Sekmeler:** **Kuyruk** (scheduled/pending, publish_at'e göre sıralı) · **Yayınlananlar** (published, izlenme/beğeni + link).
- **Video kartı:** thumbnail + konu + kanal rozeti + (kuyruk: ⏰ publish_at + durum) / (yayında: ▶ views · 👍 likes · link). Renk kodu: scheduled=mavi, published=yeşil, pending=gri, rejected=kırmızı.
- **Hata durumu:** veri çekilemezse "bağlanıyor… birazdan tekrar", son veriyi gösterir.

### 5.2 İnteraktif üretim
- "Üret"e basınca: GitHub REST `POST /repos/admlyz5858/remo/actions/workflows/produce.yml/dispatches`, body `{ref:"master", inputs:{ mode, topic, publish_at }}`, `Authorization: Bearer <PAT>`.
- **mode:** facts/money (kanal seçiminden). **topic:** kutu doluysa o, boşsa "".
- **publish_at (kuyruğa ekle):** tarayıcı, `dashboard.json`'dan o kanalın en geç `publish_at`'ini bulup **bir sonraki staggered slotu** hesaplar (DustMust 09/15 UTC, Fun Honey 11/17 UTC; günler ileriye). Hiç scheduled yoksa bir sonraki uygun slot.
- **PAT:** ⚙️'den bir kez yapıştırılır → localStorage. Yoksa buton "önce token gir" uyarır.
- Tetik sonrası: "üretiliyor… ~8 dk" göster; sonraki yenilemede kuyrukta görünür.

---

## 6. Kurulum (tek seferlik)

1. **Public `remo-dashboard` reposu** oluştur (implementasyonda yapılır).
2. **`DASHBOARD_DEPLOY_TOKEN`** secret (remo'da): dashboard reposuna yazma yetkili PAT — `dashboard.yml` push için.
3. **Kontrol PAT'i** (tarayıcıda): remo Actions yazma yetkili PAT — "Üret" butonu için (kullanıcı ⚙️'den girer).
4. **GitHub Pages** dashboard reposunda aktif edilir.

---

## 7. Etkilenen / Yeni Dosyalar

**remo:**
| Dosya | Değişiklik |
|---|---|
| `scripts/build_dashboard.js` | (yeni) history+stats → dashboard.json |
| `pipeline/01-topic.js`, `pipeline/01m-topic.js` | opsiyonel `override` |
| `pipeline/run.js` | `TOPIC` env → override geçir |
| `.github/workflows/produce.yml` | `topic` input + TOPIC env |
| `.github/workflows/dashboard.yml` | (yeni) build + public repoya push |
| `docs/SECRETS.md` | DASHBOARD_DEPLOY_TOKEN |

**remo-dashboard (yeni public repo):**
| Dosya | |
|---|---|
| `index.html` | yapı |
| `app.js` | fetch + render + üret paneli (workflow_dispatch) |
| `style.css` | koyu tema |
| `dashboard.json` | remo CI günceller (başlangıçta boş iskelet) |

---

## 8. Kapsam Dışı (YAGNI)

- WorldCup verisini dahil etmek (sadece remo).
- Gerçek zamanlı websocket (60sn polling yeterli).
- Çoklu kullanıcı/auth (kişisel; tetikleme tek PAT).
- Onay/red butonları (ileride eklenebilir; v1 sadece üret + takip).
- Sunucu/serverless (tamamen statik + GitHub API).

---

## 9. Başarı Kriterleri

1. `admlyz5858.github.io/remo-dashboard/` iki kanalı gösterir: kuyruk + yayınlananlar + metrikler + canlı izlenme/beğeni.
2. Dashboard `dashboard.json`'u 60sn'de yeniler; remo CI saatlik + produce sonrası günceller.
3. "Üret" paneli: kanal (+opsiyonel konu) seç → buton `produce.yml`'i tetikler → video bir sonraki boş slota planlanır → kuyrukta görünür.
4. Hiçbir sır public sayfada görünmez; YouTube anahtarı yalnız CI'da; tetik PAT'i yalnız tarayıcıda.
5. CLI/Claude olmadan tamamen çalışır.
6. `topic` boşsa LLM otomatik konu seçer; doluysa o konu işlenir.
7. remo'nun facts/money/cron akışları bozulmadan kalır.
