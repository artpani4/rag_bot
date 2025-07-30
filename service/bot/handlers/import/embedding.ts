// service/bot/embedding.ts

import { embedText } from "$shared";
import luminous from "$luminous";
import type { Chunk } from "./normalize.ts";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("EMBEDDINGS").build(),
);

export type Result<T, E = unknown> = { ok: true; value: T } | {
  ok: false;
  error: E;
};

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

export async function embedChunks(
  chunks: Chunk[],
): Promise<Result<EmbeddedChunk[], Error>> {
  const batchSize = 8;
  const embedded: EmbeddedChunk[] = [];
  const total = chunks.length;
  for (let i = 0; i < total; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);
    const percent = Math.floor((i / total) * 100);
    log.inf(
      `[EMBED] Прогресс: ${i + 1}-${
        Math.min(i + batchSize, total)
      }/${total} (${percent}%). Batch size: ${batch.length}`,
    );
    // log.trc(
    //   `[EMBED] Первый чанк: "${texts[0]?.slice(0, 70)}..." (${
    //     texts[0]?.split(/\s+/).length
    //   } слов)`,
    // );
    const t0 = performance.now();
    let vectors: number[][];
    try {
      vectors = await embedText(texts);
    } catch (err) {
      log.err(`❌ Ошибка эмбеддинга батча ${i + 1}-${i + batchSize}: ${err}`);
      return {
        ok: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
    const t1 = performance.now();
    log.inf(
      `✅ Batch: ${i + 1}-${
        Math.min(i + batchSize, total)
      } (${percent}%). Затрачено: ${Math.round(t1 - t0)} мс.`,
    );
    batch.forEach((chunk, idx) => {
      embedded.push({ ...chunk, embedding: vectors[idx] });
    });
  }
  return { ok: true, value: embedded };
}
