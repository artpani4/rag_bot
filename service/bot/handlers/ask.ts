// service/bot/handlers/ask.ts

import { Bot, Context } from "@grammy";
import { client as qdrant, config, embedText, verdict } from "$shared";
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

    // 1. Получаем embedding через verdict
    let embedding: number[];
    const embRes = await (async () => {
      try {
        const res = await embedText([question]);
        return verdict.ok(res[0]);
      } catch (e) {
        return verdict.err(e instanceof Error ? e.message : String(e));
      }
    })();

    return verdict.match(embRes, {
      ok: async (embedding) => {
        // 2. Проверяем наличие коллекции через verdict
        const collection = config.data.search.collection;
        const collRes = await (async () => {
          try {
            await qdrant.getCollection(collection);
            return verdict.ok(null);
          } catch (e) {
            return verdict.err(e instanceof Error ? e.message : String(e));
          }
        })();
        if (collRes.ok === false) {
          return ctx.reply(
            `⚠️ Коллекция ${collection} не найдена. Загрузите сообщения через /import.`,
          );
        }

        // 3. Поиск в Qdrant c verdict и параметрами из конфига
        const { limit, minScore } = config.data.search;
        const searchRes = await (async () => {
          try {
            const hits = await qdrant.search(collection, {
              vector: embedding,
              limit,
              with_payload: true,
              score_threshold: minScore,
            });
            return verdict.ok(hits);
          } catch (e) {
            return verdict.err(e instanceof Error ? e.message : String(e));
          }
        })();

        return verdict.match(searchRes, {
          ok: async (hits) => {
            if (!hits.length) {
              return ctx.reply("❌ Ничего не найдено.");
            }
            const response = hits
              .map((point, i) => {
                const p = point.payload as any;
                const score = point.score?.toFixed(3) ?? "?";
                return `*${i + 1}.* [${
                  p?.from || "анон"
                }]: ${p?.text}\n_Сходство: ${score}_`;
              })
              .join("\n\n");

            return ctx.reply(response, { parse_mode: "Markdown" });
          },
          err: async (errMsg) => {
            log.err("Ошибка поиска в Qdrant: " + errMsg);
            return ctx.reply("❌ Ошибка при поиске похожих сообщений.");
          },
        });
      },
      err: async (errMsg) => {
        log.err("Ошибка эмбеддинга: " + errMsg);
        return ctx.reply("❌ Ошибка при обработке вопроса.");
      },
    });
  });
}
