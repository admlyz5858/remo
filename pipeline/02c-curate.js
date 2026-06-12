const { readJSON, writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You curate a YouTube Shorts "funniest comments" video. Total video must stay UNDER 60 seconds.
Given a source title and raw comments, pick EXACTLY 4-5 of the FUNNIEST, SAFE, self-contained comments.
HARD rules:
- ENGLISH ONLY. Discard any comment that is not in clear English.
- Each comment MUST be SHORT and punchy: under ~120 characters, ONE or TWO sentences. Discard long lists/walls of text.
- NO slurs, NO NSFW/sexual, NO hate, NO personal info, NO links, NO timestamps like "1:07". Lightly clean typos/emojis (keep at most one emoji).
Respond ONLY JSON: {question, comments:[{id, author, text, upvotes}], title, description, tags}.
- question: a SHORT punchy English on-screen intro line (e.g. "The funniest comments on this 😂"), not the raw title.
- author like "u/name" or a display name. upvotes a human string like "12.4k".
- title <= 90 chars ending with " #shorts". tags 10-20 incl "comments","funny","shorts".`;

async function curateDeck({ runId, runRoot, chat }) {
  const raw = readJSON(runPath(runRoot, runId, "raw_deck.json"));
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Subreddit: r/${raw.subreddit}\nQuestion: ${raw.question}\nComments:\n${raw.comments.map((c) => `(${c.score}) ${c.text}`).join("\n")}` },
  ];
  const out = await chat({ messages });
  const deck = {
    subreddit: raw.subreddit,
    question: out.question || raw.question,
    comments: (out.comments || []).map((c, i) => ({
      id: c.id || i + 1, author: c.author || "u/redditor", text: c.text, upvotes: c.upvotes || "1k",
    })),
  };
  const meta = { title: out.title, description: out.description, tags: out.tags, category_id: 23 };
  writeJSON(runPath(runRoot, runId, "deck.json"), deck);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return deck;
}
module.exports = { curateDeck };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  curateDeck({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", chat })
    .then((d) => console.log("curated comments:", d.comments.length));
}
