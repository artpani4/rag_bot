// service/db/embeddings.ts

import { config } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("EMBEDDINGS").build(),
);

// Batching! Принимает массив текстов, возвращает массив эмбеддингов.
export async function embedText(texts: string[]): Promise<number[][]> {
  const { provider, model } = config.data.embedding;
  log.inf(
    `embedText: provider=${provider}, model=${model}, batch_size=${texts.length}`,
  );

  if (provider === "huggingface") {
    const token = config.env.HF_API_TOKEN;
    if (!token) throw new Error("HF_API_TOKEN не задан");
    const url =
      `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
    log.trc(`POST ${url} | texts: ${JSON.stringify(texts.slice(0, 2))}...`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    });

    log.trc(`HF resp status=${resp.status}`);
    if (!resp.ok) {
      const errText = await resp.text();
      log.err(`HF API error: ${errText}`);
      throw new Error(errText);
    }
    const data = await resp.json();
    log.trc(
      `HF resp data (first): ${JSON.stringify(data?.[0]?.slice?.(0, 4))}`,
    );
    if (!Array.isArray(data)) {
      log.err(`HF: неверный формат ответа: ${JSON.stringify(data)}`);
      throw new Error("HF: неверный формат ответа");
    }
    return data as number[][];
  }

  if (provider === "deepseek") {
    const key = config.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DEEPSEEK_API_KEY не задан");
    log.trc(
      `POST https://api.deepseek.com/v1/embeddings | texts: ${
        JSON.stringify(texts.slice(0, 2))
      }...`,
    );
    const resp = await fetch("https://api.deepseek.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: texts }),
    });
    log.trc(`DeepSeek resp status=${resp.status}`);
    if (!resp.ok) {
      const errText = await resp.text();
      log.err(`DeepSeek API error: ${errText}`);
      throw new Error(errText);
    }
    const data = await resp.json();
    log.trc(
      `DeepSeek resp data (first): ${
        JSON.stringify(data?.data?.[0]?.embedding?.slice?.(0, 4))
      }`,
    );
    if (!Array.isArray(data.data)) {
      log.err(`DeepSeek: неверный формат ответа: ${JSON.stringify(data)}`);
      throw new Error("DeepSeek: неверный формат ответа");
    }
    return data.data.map((e: any) => e.embedding);
  }

  log.err("Неподдерживаемый provider: " + provider);
  throw new Error("Неподдерживаемый provider");
}
