/**
 * /exit command — mirrors /quit for graceful shutdown.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Quit pi (same as /quit)",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });
}
