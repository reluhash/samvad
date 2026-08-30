export interface Language {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  isIndian: boolean;
}

export const LANGUAGES: Language[] = [
  // ── Indian Regional Languages ──────────────────────────────────────────────
  {
    code: "hi-IN",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "en-IN",
    label: "Indian English",
    nativeLabel: "Indian English",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "hi-IN-hinglish",
    label: "Hinglish (Hindi + English)",
    nativeLabel: "Hinglish",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "ta-IN",
    label: "Tamil",
    nativeLabel: "தமிழ்",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "te-IN",
    label: "Telugu",
    nativeLabel: "తెలుగు",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "kn-IN",
    label: "Kannada",
    nativeLabel: "ಕನ್ನಡ",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "ml-IN",
    label: "Malayalam",
    nativeLabel: "മലയാളം",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "mr-IN",
    label: "Marathi",
    nativeLabel: "मराठी",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "gu-IN",
    label: "Gujarati",
    nativeLabel: "ગુજરાતી",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "bn-IN",
    label: "Bengali",
    nativeLabel: "বাংলা",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "pa-IN",
    label: "Punjabi",
    nativeLabel: "ਪੰਜਾਬੀ",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "or-IN",
    label: "Odia",
    nativeLabel: "ଓଡ଼ିଆ",
    flag: "🇮🇳",
    isIndian: true,
  },
  {
    code: "ur-IN",
    label: "Urdu",
    nativeLabel: "اردو",
    flag: "🇮🇳",
    isIndian: true,
  },

  // ── Global Languages ──────────────────────────────────────────────────────
  {
    code: "en-US",
    label: "English (US)",
    nativeLabel: "English (US)",
    flag: "🇺🇸",
    isIndian: false,
  },
  {
    code: "en-GB",
    label: "English (UK)",
    nativeLabel: "English (UK)",
    flag: "🇬🇧",
    isIndian: false,
  },
  {
    code: "en-AU",
    label: "English (Australia)",
    nativeLabel: "English (Australia)",
    flag: "🇦🇺",
    isIndian: false,
  },
  {
    code: "es-ES",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    flag: "🇪🇸",
    isIndian: false,
  },
  {
    code: "es-419",
    label: "Spanish (Latin America)",
    nativeLabel: "Español (Latinoamérica)",
    flag: "🌎",
    isIndian: false,
  },
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    flag: "🇧🇷",
    isIndian: false,
  },
  {
    code: "fr-FR",
    label: "French",
    nativeLabel: "Français",
    flag: "🇫🇷",
    isIndian: false,
  },
  {
    code: "de-DE",
    label: "German",
    nativeLabel: "Deutsch",
    flag: "🇩🇪",
    isIndian: false,
  },
  {
    code: "it-IT",
    label: "Italian",
    nativeLabel: "Italiano",
    flag: "🇮🇹",
    isIndian: false,
  },
  {
    code: "ja-JP",
    label: "Japanese",
    nativeLabel: "日本語",
    flag: "🇯🇵",
    isIndian: false,
  },
  {
    code: "zh-CN",
    label: "Chinese (Simplified)",
    nativeLabel: "中文 (简体)",
    flag: "🇨🇳",
    isIndian: false,
  },
  {
    code: "ko-KR",
    label: "Korean",
    nativeLabel: "한국어",
    flag: "🇰🇷",
    isIndian: false,
  },
  {
    code: "ru-RU",
    label: "Russian",
    nativeLabel: "Русский",
    flag: "🇷🇺",
    isIndian: false,
  },
  {
    code: "ar-SA",
    label: "Arabic",
    nativeLabel: "العربية",
    flag: "🇸🇦",
    isIndian: false,
  },
];

export const INDIAN_LANGUAGES = LANGUAGES.filter((l) => l.isIndian);
export const GLOBAL_LANGUAGES = LANGUAGES.filter((l) => !l.isIndian);

/** Map from language code to display label */
export const LANGUAGE_MAP = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l])
);

/**
 * System prompt prefixes for Indian language telecalling.
 * These instruct the agent to respond in the correct language and style.
 */
export const INDIAN_LANGUAGE_PROMPTS: Record<string, string> = {
  "hi-IN": `You are a helpful telecalling agent. Always respond in Hindi (हिन्दी). Use clear, polite, and professional Hindi. Address the caller respectfully using "आप". Keep responses concise and natural for a phone conversation.`,
  "en-IN": `You are a helpful telecalling agent. Always respond in Indian English with a natural Indian accent and phrasing. Be polite, professional, and culturally aware of Indian context. Keep responses concise and natural for a phone conversation.`,
  "hi-IN-hinglish": `You are a helpful telecalling agent. Always respond in Hinglish — a natural mix of Hindi and English commonly spoken in India. Use casual, friendly language that feels natural. For example: "Aapka order process ho raha hai" or "Main aapki help kar sakta hoon". Keep it conversational and easy to understand.`,
  "ta-IN": `You are a helpful telecalling agent. Always respond in Tamil (தமிழ்). Use clear, polite, and professional Tamil. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "te-IN": `You are a helpful telecalling agent. Always respond in Telugu (తెలుగు). Use clear, polite, and professional Telugu. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "kn-IN": `You are a helpful telecalling agent. Always respond in Kannada (ಕನ್ನಡ). Use clear, polite, and professional Kannada. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "ml-IN": `You are a helpful telecalling agent. Always respond in Malayalam (മലയാളം). Use clear, polite, and professional Malayalam. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "mr-IN": `You are a helpful telecalling agent. Always respond in Marathi (मराठी). Use clear, polite, and professional Marathi. Address the caller respectfully using "तुम्ही". Keep responses concise and natural for a phone conversation.`,
  "gu-IN": `You are a helpful telecalling agent. Always respond in Gujarati (ગુજરાતી). Use clear, polite, and professional Gujarati. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "bn-IN": `You are a helpful telecalling agent. Always respond in Bengali (বাংলা). Use clear, polite, and professional Bengali. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
  "pa-IN": `You are a helpful telecalling agent. Always respond in Punjabi (ਪੰਜਾਬੀ). Use clear, polite, and professional Punjabi. Address the caller respectfully. Keep responses concise and natural for a phone conversation.`,
};

