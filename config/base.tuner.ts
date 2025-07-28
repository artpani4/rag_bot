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
    PORT: Tuner.Env.getNumber.orDefault(8000),
    DEV: Tuner.Env.getBoolean.orDefault(true),
  },
  data: {
    embedding: {
      provider: "huggingface", // "huggingface" | "deepseek"
      model: "BAAI/bge-large-en-v1.5",
    },
  },
});
export default config;
export type ConfigType = typeof config;
