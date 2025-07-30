// service/bot/handlers/import/import_smart.ts

import { Bot } from "@grammy";
import { Api, Context as Ctx, RawApi } from "@grammy";
import luminous from "$luminous";
import { upsert } from "../../../db/qdrant.ts";
import { config } from "$shared";

import { embedChunks, EmbeddedChunk, Result } from "./embedding.ts";
import {
  createChunks,
  groupMessages,
  normalizeMessages,
  parseJson,
} from "./normalize.ts";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("SMART_IMPORT").build(),
);

async function fetchFileAsString(
  fileUrl: string,
): Promise<Result<string, Error>> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return {
        ok: false,
        error: new Error("Ошибка скачивания файла: " + res.statusText),
      };
    }
    return { ok: true, value: await res.text() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function smartImportFromUrl(
  chatId: number,
  fileUrl: string,
  api: Api<RawApi>,
) {
  await api.sendMessage(chatId, `📥 Загружаем и парсим файл...`);
  const textRes = await fetchFileAsString(fileUrl);
  if (!textRes.ok) {
    log.err("Ошибка скачивания: " + textRes.error);
    await api.sendMessage(chatId, "❌ Не удалось скачать файл.");
    return;
  }
  const json = parseJson(textRes.value);
  if (!json) {
    log.err("Ошибка парсинга JSON");
    await api.sendMessage(chatId, "❌ Не удалось распарсить JSON файл.");
    return;
  }
  const normalized = normalizeMessages(json.messages);
  // --- Используем параметры из config.data.chunking
  const groups = groupMessages(normalized, config.data.chunking.max_gap_ms);
  const chunks = createChunks(
    groups,
    config.data.chunking.max_tokens,
    config.data.chunking.overlap,
    config.data.chunking.min_words,
  );
  await api.sendMessage(
    chatId,
    `⚙️ Сообщений: ${normalized.length}, групп: ${groups.length}, чанков: ${chunks.length}.\nНачинаю эмбеддинг...`,
  );
  const embedRes = await embedChunks(chunks);
  if (!embedRes.ok) {
    log.err("Ошибка эмбеддинга: " + embedRes.error);
    await api.sendMessage(
      chatId,
      "❌ Ошибка при эмбеддинге: " + String(embedRes.error),
    );
    return;
  }
  const embedded = embedRes.value;
  await saveToQdrant(chatId, embedded);
  await api.sendMessage(chatId, `✅ Импортировано ${embedded.length} чанков.`);
}

export async function saveToQdrant(
  chatId: number,
  chunks: EmbeddedChunk[],
): Promise<void> {
  const points = chunks.map((c) => ({
    id: parseInt(c.id.replace("c_", "")),
    vector: c.embedding,
    payload: {
      text: c.text,
      chat_id: chatId,
      source_ids: c.sourceMessageIds,
    },
  }));
  await upsert("chat_" + chatId, points);
}

// --- Хендлер для бота ---
export function registerSmartImportHandler(bot: Bot<Ctx, Api<RawApi>>) {
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message?.document;
    if (!doc?.file_name?.endsWith(".json")) {
      return ctx.reply("⛔️ Только .json файлы поддерживаются!");
    }

    let fileUrl: string;
    try {
      const tgFile = await ctx.api.getFile(doc.file_id);
      fileUrl =
        `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${tgFile.file_path}`;
    } catch (e) {
      return ctx.reply("❌ Не удалось получить файл.");
    }

    await ctx.reply(
      "📥 Файл получен, начинаю smart-обработку...\n(Результат придет отдельным сообщением)",
    );

    // Не блокируем обработчик!
    (async () => {
      await smartImportFromUrl(ctx.chat.id, fileUrl, ctx.api);
    })();
  });
}
