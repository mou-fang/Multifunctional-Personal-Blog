window.CLAUDE_ONE_CONFIG = Object.freeze({
  deepseek: Object.freeze({
    baseUrl: "https://api.deepseek.com",
    chatPath: "/chat/completions",
    defaultModel: "deepseek-v4-flash",
    models: Object.freeze(["deepseek-v4-flash", "deepseek-v4-pro"]),
    systemPrompt:
      "You are a calm, precise AI assistant inside a quiet personal workspace. Be concise, practical, and aesthetically restrained.",
    storageKey: "claudeOne:deepseek-key",
    defaultTemperature: 0.8,
    defaultMaxTokens: 4096,
  }),
  theme: Object.freeze({
    storageKey: "claudeOne:theme",
    default: "neumorphism",
    values: Object.freeze(["neumorphism", "liquid-glass"]),
  }),
  limits: Object.freeze({
    playerNameMax: 16,
    chatInputMax: 4000,
    playersMin: 2,
    playersMax: 10,
    chamberMin: 4,
    chamberMax: 12,
    lotteryParticipantsMin: 2,
    lotteryParticipantsMax: 300,
    lotteryParticipantNameMax: 24,
    lotteryPrizeNameMax: 24,
    lotteryPrizeQuotaMax: 100,
  }),
});
