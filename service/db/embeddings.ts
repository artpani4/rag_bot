import { config } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("EMBEDDINGS").build(),
);

function estimateTokens(text: string): number {
  // Очень грубо: split по пробелам
  return text.split(/\s+/).length;
}

export async function embedText(
  texts: string[],
): Promise<number[][]> {
  const { provider, model } = config.data.embedding;
  // Для Qwen/Qwen3 universal не нужен, только legacy endpoint
  // universal = false — только legacy
  const universal = false;

  const totalTokens = texts.reduce((sum, txt) => sum + estimateTokens(txt), 0);
  log.inf(
    `embedText: provider=${provider}, model=${model}, batch_size=${texts.length}, approx_tokens=${totalTokens}`,
  );

  // Only HF/Nebius (legacy pipeline)
  if (provider === "huggingface" || provider === "nebius") {
    const token = config.env.HF_API_TOKEN;
    if (!token) throw new Error("HF_API_TOKEN не задан");

    // Для Qwen3 и большинства sentence-transformers нужен именно этот endpoint
    const url =
      `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
    const body = {
      inputs: texts,
      options: { wait_for_model: true },
    };

    log.trc(`POST ${url} | texts: ${JSON.stringify(texts.slice(0, 2))}...`);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    log.trc(`HF resp status=${resp.status}`);
    if (!resp.ok) {
      const errText = await resp.text();
      log.err(`HF API error: ${errText}`);
      throw new Error(errText);
    }

    const data = await resp.json();

    // Qwen3-Embedding-0.6B возвращает массив эмбеддингов
    if (!Array.isArray(data)) {
      log.err(`HF: неверный формат ответа: ${JSON.stringify(data)}`);
      throw new Error("HF: неверный формат ответа");
    }
    // data: [ [ ... ], [ ... ], ... ] (batch-режим)
    return data as number[][];
  }

  log.err("Неподдерживаемый provider: " + provider);
  throw new Error("Неподдерживаемый provider");
}
