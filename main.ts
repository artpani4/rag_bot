import { webhookCallback } from "@grammy";
import { Context, Next } from "@hono";
import { app, bot } from "./shared.ts";
import { startHandler } from "./service/bot/handlers/start.ts";

import { Api, Context as Ctx, RawApi } from "@grammy";
import { registerAskHandler } from "./service/bot/handlers/ask.ts";
import { registerSmartImportHandler } from "./service/bot/handlers/import/import_smart.ts";

export const botHandleUpdate = webhookCallback(bot, "hono");

app.post("/telegramGetUpdates", async (c: Context, next: Next) => {
  try {
    return await botHandleUpdate(c);
  } catch (e) {
    console.error(e);
  }
  await next();
});

bot.command("start", startHandler);
// registerImportHandler(bot);
registerSmartImportHandler(bot);
registerAskHandler(bot);
Deno.serve(app.fetch);

// import { upsert } from "./service/db/qdrant.ts";

// const testPoints = [
//   {
//     id: 1,
//     vector: Array(1024).fill(0.123),
//     payload: {
//       text: "Привет!",
//       user: "artpani",
//     },
//   },
// ];

// const result = await upsert("chat_4598168443", testPoints);

// console.log(JSON.stringify(result, null, 2));
