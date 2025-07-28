// service/bot/handlers/import_worker.ts

import { ChatData } from "../../../types.ts";
import { config, embedText } from "$shared";
import { upsert } from "../../db/qdrant.ts";
import luminous from "$luminous";
import { Api, RawApi } from "@grammy";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("IMPORT_WORKER").build(),
);

export async function processChatImport(
  chatId: number,
  fileUrl: string,
  api: Api<RawApi>,
) {
  // Скачиваем
  let jsonStr: string;
  try {
    jsonStr = await (await fetch(fileUrl)).text();
    log.trc("Файл скачан, размер " + jsonStr.length + " bytes");
  } catch (e) {
    log.err("Ошибка скачивания: " + e);
    await api.sendMessage(chatId, "❌ Не удалось скачать файл.");
    return;
  }

  // Парсим
  let chatData: ChatData;
  try {
    chatData = JSON.parse(jsonStr);
  } catch (e) {
    log.err("Ошибка парсинга JSON: " + e);
    await api.sendMessage(chatId, "❌ Неверный формат JSON.");
    return;
  }

  if (!Array.isArray(chatData.messages)) {
    log.err("Нет поля messages");
    await api.sendMessage(chatId, "❌ В файле нет массива messages.");
    return;
  }

  log.inf(`В файле ${chatData.messages.length} сообщений`);

  const plainMessages = chatData.messages.filter(
    (m) =>
      m.type === "message" &&
      typeof m.text === "string" &&
      m.text.trim().length > 0,
  );

  if (!plainMessages.length) {
    return api.sendMessage(chatId, "В файле не найдено текстовых сообщений.");
  }

  if (plainMessages.length > 10000) {
    return api.sendMessage(chatId, "❌ Слишком много сообщений (>10000).");
  }

  await api.sendMessage(
    chatId,
    `📊 Импортируем ${plainMessages.length} сообщений...`,
  );
  log.inf("Начинаем эмбеддинг и импорт");

  const BATCH_SIZE = 32;
  let ok = 0, errors = 0;
  const batches = Math.ceil(plainMessages.length / BATCH_SIZE);

  for (let i = 0; i < plainMessages.length; i += BATCH_SIZE) {
    const batch = plainMessages.slice(i, i + BATCH_SIZE);
    log.inf(`Батч ${i / BATCH_SIZE + 1} из ${batches}, size=${batch.length}`);

    const texts = batch.map((m) => m.text);
    let vectors: number[][];

    try {
      vectors = await embedText(texts);
    } catch (e) {
      log.err("Ошибка эмбеддинга: " + e);
      errors += batch.length;
      continue;
    }

    const points = batch.map((msg, idx) => ({
      id: Number(msg.id),
      vector: vectors[idx],
      payload: {
        text: msg.text,
        date: msg.date,
        from: msg.from,
        chat_id: chatData.id,
        meta: msg,
      },
    }));

    try {
      await upsert("chat_" + chatData.id, points);
      ok += points.length;
    } catch (e) {
      log.err("Ошибка вставки в Qdrant: " + e);
      errors += points.length;
    }

    if ((i / BATCH_SIZE) % 5 === 0) {
      await api.sendMessage(chatId, `⏳ Импортировано: ${ok} сообщений...`);
    }
  }

  await api.sendMessage(
    chatId,
    `✅ Импорт завершён. Успешно: ${ok}, ошибок: ${errors}`,
  );
  log.inf(`Импорт завершён: успешно=${ok}, ошибок=${errors}`);
}
