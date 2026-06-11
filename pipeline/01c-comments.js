const { writeJSON, runPath } = require("./lib/fsx");
const { pickFrom } = require("./lib/seed");

// deps: { getPost(subreddit)->{id,subreddit,title}, getComments(subreddit,postId)->[{author,text,score}] }
async function fetchRawDeck({ runId, runRoot, seed, subreddits, deps }) {
  const sub = pickFrom(seed, subreddits);
  const post = await deps.getPost(sub);
  const comments = await deps.getComments(post.subreddit, post.id);
  const raw = { subreddit: post.subreddit, postId: post.id, question: post.title, comments };
  writeJSON(runPath(runRoot, runId, "raw_deck.json"), raw);
  return raw;
}
module.exports = { fetchRawDeck };

if (require.main === module) {
  const cfg = require("./config");
  const { fetchTopPost, fetchComments } = require("./lib/reddit");
  const ua = process.env.REDDIT_USER_AGENT || "remo-bot/1.0 (by /u/remo)";
  const deps = {
    getPost: (sub) => fetchTopPost(sub, { userAgent: ua }),
    getComments: (sub, id) => fetchComments(sub, id, { userAgent: ua }),
  };
  fetchRawDeck({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", seed: process.env.RUN_ID, subreddits: cfg.subreddits, deps })
    .then((d) => console.log("raw comments:", d.comments.length));
}
