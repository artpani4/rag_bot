import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { Bot } from "@grammy";

import { QdrantClient } from "@qdrant";
import * as hono from "jsr:@hono/hono";

import * as verdict from "@artpani/verdict";

//
import Tuner from "@artpani/tuner";
import { ConfigType } from "./config/base.tuner.ts";
import { embedText } from "./service/db/embeddings.ts";

export { embedText };

export const config = await Tuner.use.loadConfig<ConfigType>();

export const app = new hono.Hono();
export const supabase: SupabaseClient = createSupabaseClient(
  config.env.SUPABASE_URL,
  config.env.SUPABASE_KEY,
);

export const client = new QdrantClient({
  url: config.env.QDRANT_URL,
  apiKey: config.env.QDRANT_API_KEY,
});

export const bot = new Bot(config.env.TG_BOT_TOKEN);

export { verdict };
