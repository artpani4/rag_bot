import Tuner from "@artpani/tuner";

const config = Tuner.tune({
  env: {
    TG_BOT_TOKEN: Tuner.Env.getString.orExit("BOT token required"),
    SUPABASE_URL: Tuner.Env.getString.orExit("SUPABASE_URL required"),
    SUPABASE_KEY: Tuner.Env.getString.orExit("SUPABASE_KEY required"),
    QDRANT_URL: Tuner.Env.getString.orExit("QDRANT_URL required"),
    QDRANT_API_KEY: Tuner.Env.getString.orExit("QDRANT_API_KEY required"),
    HF_API_TOKEN: Tuner.Env.getString.orExit("HF_API_TOKEN required!!"), // optional для HF
    DEEPSEEK_API_KEY: Tuner.Env.getString.orExit("DEEPSEEK_API_KEY required!!"), // optional для DeepSeek
    WEBHOOK_URL: Tuner.Env.getString.orExit(),
  },
  data: {
    embedding: {
      provider: "huggingface", // "huggingface" | "nebius"
      model: "intfloat/multilingual-e5-large",
    },
    chunking: {
      max_gap_ms: 15 * 60 * 1000, // временное окно между сообщениями (по умолчанию 15 мин)
      max_tokens: 160, // сколько максимум слов/токенов в чанке
      overlap: 50, // overlap между чанками
      min_words: 7, // минимальное число слов в чанке
    },
    search: {
      limit: 10,
      minScore: 0.8,
      collection: "chat_406327101",
    },
  },
});
export default config;
export type ConfigType = typeof config;
