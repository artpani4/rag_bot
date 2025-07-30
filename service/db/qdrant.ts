import { client as qdrant } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("QDRANT").build(),
);

function sanitizePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (
      v !== undefined &&
      v !== null &&
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    ) {
      result[k] = v;
    }
  }
  return result;
}

export async function upsert(
  collection: string,
  points: Array<{
    id: number;
    vector: number[];
    payload: any;
  }>,
) {
  const vectorSize = points[0]?.vector?.length;
  if (!vectorSize || !Array.isArray(points[0].vector)) {
    throw new Error("Invalid vector format or empty points list");
  }

  // Получим конфиг коллекции (или создадим её)
  let strictMode = true;
  try {
    const info = await qdrant.getCollection(collection);
    const declaredSize = info.config?.params?.vectors?.size;
    strictMode = info.config?.strict_mode_config?.enabled as boolean ?? true;

    if (declaredSize !== vectorSize) {
      throw new Error(
        `Vector size mismatch: collection expects ${declaredSize}, but got ${vectorSize}`,
      );
    }
    log.inf(`Коллекция ${collection} существует. strict_mode=${strictMode}`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Not Found") || msg.includes("does not exist")) {
      log.inf(`Коллекция ${collection} не найдена — создаём`);
      await qdrant.createCollection(collection, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
      log.inf(`✅ Коллекция ${collection} создана (strict_mode=true)`);
    } else {
      log.err("Ошибка получения коллекции: " + msg);
      throw e;
    }
  }

  // Подготовим точки
  const preparedPoints = points.map((p, i) => {
    if (!p.payload) {
      log.err(`🚨 payload отсутствует у точки id=${p.id}`);
    }
    // log.trc(
    //   `Payload [${i}] до очистки:\n${JSON.stringify(p.payload, null, 2)}`,
    // );
    const cleaned = sanitizePayload(p.payload ?? {});
    if (Object.keys(cleaned).length === 0 && strictMode) {
      cleaned.__dummy = "strict-mode-requires-something";
    }
    return {
      id: p.id,
      vector: p.vector,
      payload: cleaned,
    };
  });

  try {
    await qdrant.upsert(collection, { points: preparedPoints });
    log.inf(`🟢 Upsert ${preparedPoints.length} точек в ${collection}`);
  } catch (e) {
    log.err("Ошибка при upsert в Qdrant: " + e);
    log.trc(`Пример точки:\n${JSON.stringify(preparedPoints[0], null, 2)}`);
    throw e;
  }
}
