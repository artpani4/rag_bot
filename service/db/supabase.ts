import { supabase, verdict } from "$shared";
import luminous from "$luminous";
import type { TelegramUser } from "../../types.ts";
const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("SUPABASE").build(),
);

export async function upsertUser(
  user: TelegramUser,
): Promise<verdict.Result<TelegramUser, string>> {
  const { data, error } = await supabase
    .from("telegram_users")
    .upsert([user])
    .select()
    .single();

  if (error) {
    return verdict.err(error.message ?? "Unknown supabase error");
  }
  return verdict.ok(data as TelegramUser);
}

export async function getUserById(
  telegram_id: number,
): Promise<verdict.Result<TelegramUser, string>> {
  const { data, error } = await supabase
    .from("telegram_users")
    .select()
    .eq("telegram_id", telegram_id)
    .single();

  if (error) {
    return verdict.err(error.message ?? "Unknown supabase error");
  }
  return verdict.ok(data as TelegramUser);
}
