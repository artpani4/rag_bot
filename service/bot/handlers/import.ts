// service/bot/handlers/import.ts

import { Bot } from "https://deno.land/x/grammy@v1.36.1/bot.ts";
import { Api, Context as Ctx, RawApi } from "@grammy";
import { config } from "$shared";
import luminous from "$luminous";
import { ChatData } from "../../../types.ts";
import { processChatImport } from "./import_worker.ts";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("IMPORT_HANDLER").build(),
);

export function registerImportHandler(bot: Bot<Ctx, Api<RawApi>>) {
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message?.document;
    if (!doc?.file_name?.endsWith(".json")) {
      return ctx.reply("⛔️ Только .json файлы поддерживаются!");
    }

    log.inf(`Получен файл: ${doc.file_name} (${doc.file_size} bytes)`);

    // Получаем ссылку
    let fileUrl: string;
    try {
      const tgFile = await ctx.api.getFile(doc.file_id);
      fileUrl =
        `https://api.telegram.org/file/bot${config.env.TG_BOT_TOKEN}/${tgFile.file_path}`;
      log.trc("Получена ссылка на файл: " + fileUrl);
    } catch (e) {
      log.err("Ошибка получения ссылки: " + e);
      return ctx.reply("❌ Не удалось получить ссылку на файл.");
    }

    // Ответ сразу, остальное — в фоне
    await ctx.reply("📥 Файл получен, начинаю обработку в фоне...");

    processChatImport(ctx.chat.id, fileUrl, ctx.api).catch((err) => {
      log.err("Фоновый импорт завершился с ошибкой: " + err);
    });
  });
}
