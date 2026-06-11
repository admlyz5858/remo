const { readJSON, writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You curate a YouTube Shorts "funniest Reddit answers" video.
Given a question and raw comments, pick the 5-8 FUNNIEST, SAFE, self-contained comments.
HARD rules: NO slurs, NO NSFW/sexual, NO hate, NO personal info, NO links. Lightly clean typos/markdown; keep each comment under ~200 chars.
Respond ONLY JSON: {question, comments:[{id, author, text, upvotes}], title, description, tags}.
- Keep the question concise. author like "u/name". upvotes a human string like "12.4k".
- title <= 90 chars ending with " #shorts". tags 10-20 incl "reddit","askreddit","shorts".`;

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
