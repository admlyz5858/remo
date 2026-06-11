function pickPortraitVideo(files) {
  const portrait = files.filter((f) => f.height >= f.width);
  const pool = portrait.length ? portrait : files;
  pool.sort((a, b) => b.height - a.height);
  return pool[0] && pool[0].link;
}

async function pexels(query, { apiKey, fetchImpl = fetch }) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`;
  const r = await fetchImpl(url, { headers: { Authorization: apiKey } });
  if (!r.ok) return null;
  const d = await r.json();
  const vid = (d.videos || [])[0];
  const link = vid && pickPortraitVideo(vid.video_files || []);
  return link ? { type: "video", url: link } : null;
}

async function pixabay(query, { apiKey, fetchImpl = fetch, kind = "video" }) {
  if (kind === "video") {
    const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=5`;
    const r = await fetchImpl(url, {});
    if (r.ok) {
      const d = await r.json();
      const hit = (d.hits || [])[0];
      const link = hit && hit.videos && (hit.videos.large || hit.videos.medium);
      if (link && link.url) return { type: "video", url: link.url };
    }
  }
  const iurl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=5`;
  const r = await fetchImpl(iurl, {});
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.hits || [])[0];
  return hit && hit.largeImageURL ? { type: "image", url: hit.largeImageURL } : null;
}

async function unsplash(query, { apiKey, fetchImpl = fetch }) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5&client_id=${apiKey}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.results || [])[0];
  return hit && hit.urls ? { type: "image", url: hit.urls.regular } : null;
}

async function pexelsVideoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}`;
  const r = await fetchImpl(url, { headers: { Authorization: apiKey } });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.videos || [])
    .map((v) => ({ link: pickPortraitVideo(v.video_files || []), id: String(v.id) }))
    .filter((x) => x.link)
    .map((x) => ({ type: "video", url: x.link, id: x.id }));
}

async function pixabayVideoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.hits || [])
    .map((h) => ({ link: h.videos && (h.videos.large || h.videos.medium), id: String(h.id) }))
    .filter((x) => x.link && x.link.url)
    .map((x) => ({ type: "video", url: x.link.url, id: x.id }));
}

async function pixabayPhotoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=${perPage}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.hits || [])
    .filter((h) => h.largeImageURL)
    .map((h) => ({ type: "image", url: h.largeImageURL, id: String(h.id) }));
}

async function unsplashCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}&client_id=${apiKey}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || [])
    .filter((h) => h.urls && h.urls.regular)
    .map((h) => ({ type: "image", url: h.urls.regular, id: String(h.id) }));
}

module.exports = { pexels, pixabay, unsplash, pickPortraitVideo,
  pexelsVideoCandidates, pixabayVideoCandidates, pixabayPhotoCandidates, unsplashCandidates };
