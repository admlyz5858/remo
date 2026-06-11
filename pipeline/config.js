module.exports = {
  render: { width: 1080, height: 1920, fps: 30 },
  voice: "en-US-ChristopherNeural",
  ttsRate: "+8%",
  stockOrder: ["pexels", "pixabay", "unsplash"],
  model: "deepseek/deepseek-chat",
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
  accentPalette: ["#FFD400", "#FF4D6D", "#33D6A6", "#4DA3FF", "#B26BFF"],
  transitions: ["slideLeft", "slideUp", "zoomIn", "fade"],
  // Video-first candidate order used by stage 05.
  mediaOrder: ["pexelsVideo", "pixabayVideo", "pixabayPhoto", "unsplash"],
  music: { dir: "remotion/public/music", volume: 0.1 },
  sfx: { dir: "remotion/public/sfx" },
  visionModel: "gemini-2.0-flash",
};
