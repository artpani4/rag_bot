// service/bot/handlers/ask.ts

import { Bot, Context } from "@grammy";
import { embedText } from "$shared";
import { client as qdrant } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("ASK_HANDLER").build(),
);

export function registerAskHandler(bot: Bot<Context>) {
  bot.command("ask", async (ctx) => {
    const question = ctx.message?.text?.split(" ").slice(1).join(" ").trim();

    if (!question) {
      return ctx.reply(
        "❔ Введите вопрос после команды /ask, например: /ask как работает импорт?",
      );
    }

    log.inf("Вопрос: " + question);

    // 1. Получаем embedding
    let embedding: number[];
    try {
      const result = await embedText([question]);
      embedding = result[0];
    } catch (e) {
      log.err("Ошибка эмбеддинга: " + e);
      return ctx.reply("❌ Ошибка при обработке вопроса.");
    }

    // 2. Жёстко указываем ID коллекции
    const collection = "chat_4598168443";

    try {
      await qdrant.getCollection(collection);
    } catch {
      return ctx.reply(
        `⚠️ Коллекция ${collection} не найдена. Загрузите сообщения через /import.`,
      );
    }

    // 3. Поиск в Qdrant
    let searchResult;
    try {
      searchResult = await qdrant.search(collection, {
        vector: embedding,
        limit: 5,
        with_payload: true,
      });
    } catch (e) {
      log.err("Ошибка поиска в Qdrant: " + e);
      return ctx.reply("❌ Ошибка при поиске похожих сообщений.");
    }

    if (!searchResult.length) {
      return ctx.reply("❌ Ничего не найдено.");
    }

    const response = searchResult
      .map((point, i) => {
        const p = point.payload as any;
        const score = point.score?.toFixed(3) ?? "?";
        return `*${i + 1}.* [${
          p?.from || "анон"
        }]: ${p?.text}\n_Сходство: ${score}_`;
      })
      .join("\n\n");

    return ctx.reply(response, { parse_mode: "Markdown" });
  });
}
