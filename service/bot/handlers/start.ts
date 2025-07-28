import { Context } from "@grammy";
import { upsertUser } from "../../db/supabase.ts";
import { verdict } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("START_HANDLER").build(),
);

export async function startHandler(ctx: Context) {
  const user = ctx.from;
  if (!user) {
    log.err("Не удалось определить пользователя: ctx.from отсутствует");
    await ctx.reply("⛔️ Не удалось определить пользователя.");
    return;
  }

  // Логируем полученные данные от Telegram
  log.inf(`Запуск startHandler для user_id=${user.id}`);
  log.trc(`ctx.from: ${JSON.stringify(user, null, 2)}`);

  const userData = {
    telegram_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    language_code: user.language_code ?? null,
    is_bot: user.is_bot ?? null,
    is_premium: (user as any).is_premium ?? null,
  };

  log.inf(`Пробуем upsertUser с userData: ${JSON.stringify(userData)}`);

  const res = await upsertUser(userData);

  verdict.match(res, {
    ok: async (userObj) => {
      log.inf(`✅ User upsert успешен: telegram_id=${userObj.telegram_id}`);
      log.trc(`User из базы: ${JSON.stringify(userObj)}`);
      await ctx.reply(
        `👋 Привет, ${
          userObj.first_name || userObj.username || "друг"
        }! Данные обновлены.`,
      );
    },
    err: async (errMsg) => {
      log.err(`❌ Ошибка при upsertUser: ${errMsg}`);
      await ctx.reply("❌ Ошибка при обновлении пользователя");
    },
  });
}
