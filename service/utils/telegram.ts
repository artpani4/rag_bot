import { bot, config, verdict } from "$shared";
import luminous from "$luminous";

const log = new luminous.Logger(
  new luminous.OptionsBuilder().setName("SETWEBHOOK").build(),
);

const baseUrl = config.env.WEBHOOK_URL;

const baseUrlResult = baseUrl
  ? verdict.ok(baseUrl)
  : verdict.err("WEBHOOK_URL environment variable is not set!");

await verdict.match(baseUrlResult, {
  ok: async (url) => {
    const webhookUrl = `${url}`;
    log.inf(`Setting webhook to: ${webhookUrl}`);

    const setWebhookResult = await verdict.fromThrowable(
      () => bot.api.setWebhook(webhookUrl),
      (e) => e instanceof Error ? e.message : String(e),
    )();

    verdict.match(setWebhookResult, {
      ok: async (resp) => {
        if (await resp) {
          log.inf(`✅ Webhook set successfully to: ${webhookUrl}`);
        } else {
          log.err("Failed to set webhook");
          Deno.exit(1);
        }
      },
      err: (errMsg) => {
        log.err(`Error setting webhook: ${errMsg}`);
        Deno.exit(1);
      },
    });
  },
  err: (msg) => {
    log.err(msg);
    Deno.exit(1);
  },
});
