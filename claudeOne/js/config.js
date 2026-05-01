window.CLAUDE_ONE_CONFIG = Object.freeze({
  deepseek: Object.freeze({
    baseUrl: "https://api.deepseek.com",
    chatPath: "/chat/completions",
    defaultModel: "deepseek-v4-flash",
    models: Object.freeze(["deepseek-v4-flash", "deepseek-v4-pro"]),
    systemPrompt:
      "You are a calm, precise AI assistant inside a quiet personal workspace. Be concise, practical, and aesthetically restrained.",
    storageKey: "claudeOne:deepseek-key",
    systemPromptKey: "claudeOne:deepseek-system-prompt",
    systemPromptMax: 2000,
    prefsKey: "claudeOne:deepseek-prefs",
    topicsKey: "claudeOne:deepseek-topics",
    activeTopicKey: "claudeOne:deepseek-active-topic",
    maxTopics: 50,
    promptPresets: Object.freeze([
      Object.freeze({
        id: "default",
        label: "默认",
        prompt:
          "You are a calm, precise AI assistant inside a quiet personal workspace. Be concise, practical, and aesthetically restrained.",
      }),
      Object.freeze({
        id: "coder",
        label: "编程导师",
        prompt:
          "你是一位资深软件工程师与导师。回答时优先给出最简洁的可运行代码，关键处加一两行解释；指出潜在陷阱与更优写法；用中文交流，但代码、API 名称保持英文。",
      }),
      Object.freeze({
        id: "translator",
        label: "翻译润色",
        prompt:
          "你是一位精通中英双语的语言专家。任务是翻译并润色用户提供的文本：保留原意，让译文自然、地道、节奏顺畅。如果用户给的是中文就翻成英文，反之亦然。只输出最终译文，不加解释，除非用户问。",
      }),
      Object.freeze({
        id: "brainstorm",
        label: "头脑风暴",
        prompt:
          "你是一位富有创造力的头脑风暴伙伴。请基于用户的主题给出 5-8 个角度新颖、彼此差异化的想法，每个想法用一句话说清核心点，必要时再补一句可执行的下一步。",
      }),
    ]),
    defaultTemperature: 0.8,
    defaultMaxTokens: 4096,
  }),
  theme: Object.freeze({
    storageKey: "claudeOne:theme",
    default: "neumorphism",
    values: Object.freeze(["neumorphism", "liquid-glass"]),
  }),
  music: Object.freeze({
    supportedExts: Object.freeze([
      ".ncm", ".qmc0", ".qmc3", ".qmcflac", ".qmcogg",
      ".mflac", ".mgg", ".tkm", ".bkcmp3", ".bkcflac",
      ".tm0", ".tm2", ".tm3", ".tm6",
    ]),
    maxFileSize: 200 * 1024 * 1024,
    storageKey: "claudeOne:music-naming",
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
