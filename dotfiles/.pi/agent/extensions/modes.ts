import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Key, type AutocompleteItem } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─── Bash safety patterns (mirrors plan-mode extension) ───────────────────────

// Destructive commands blocked in read-only modes
const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i,
	/\brmdir\b/i,
	/\bmv\b/i,
	/\bcp\b/i,
	/\bmkdir\b/i,
	/\btouch\b/i,
	/\bchmod\b/i,
	/\bchown\b/i,
	/\bchgrp\b/i,
	/\bln\b/i,
	/\btee\b/i,
	/\btruncate\b/i,
	/\bdd\b/i,
	/\bshred\b/i,
	/(^|[^<>])>(?!>)/,
	/>>/,
	/\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
	/\byarn\s+(add|remove|install|publish)/i,
	/\bpnpm\s+(add|remove|install|publish)/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade)/i,
	/\bgit(?:\s+-C\s+(?:"[^"]+"|'[^']+'|[^\s;&|<>`$()]+))?\s+(add|commit|push|pull|fetch|merge|rebase|reset|checkout|switch|restore|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone|rm|worktree\s+(add|remove|move|prune|repair))\b/i,
	/\bclang-format\b[^\n]*\s-i(?:\s|$)/i,
	/\bsudo\b/i,
	/\bsu\b/i,
	/\bkill\b/i,
	/\bpkill\b/i,
	/\bkillall\b/i,
	/\breboot\b/i,
	/\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/i,
	/\bservice\s+\S+\s+(start|stop|restart)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

// Safe read-only commands allowed when bash is restricted
const SAFE_PATTERNS = [
	/^\s*cat\b/,
	/^\s*head\b/,
	/^\s*tail\b/,
	/^\s*less\b/,
	/^\s*more\b/,
	/^\s*grep\b/,
	/^\s*find\b/,
	/^\s*ls\b/,
	/^\s*pwd\b/,
	/^\s*echo\b/,
	/^\s*printf\b/,
	/^\s*wc\b/,
	/^\s*sort\b/,
	/^\s*uniq\b/,
	/^\s*diff\b/,
	/^\s*file\b/,
	/^\s*stat\b/,
	/^\s*du\b/,
	/^\s*df\b/,
	/^\s*tree\b/,
	/^\s*which\b/,
	/^\s*whereis\b/,
	/^\s*type\b/,
	/^\s*env\b/,
	/^\s*printenv\b/,
	/^\s*uname\b/,
	/^\s*whoami\b/,
	/^\s*id\b/,
	/^\s*date\b/,
	/^\s*cal\b/,
	/^\s*uptime\b/,
	/^\s*ps\b/,
	/^\s*top\b/,
	/^\s*htop\b/,
	/^\s*free\b/,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
	/^\s*git\s+ls-/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
	/^\s*yarn\s+(list|info|why|audit)/i,
	/^\s*node\s+--version/i,
	/^\s*python\s+--version/i,
	/^\s*curl\s/i,
	/^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/,
	/^\s*sed\s+-n/i,
	/^\s*awk\b/,
	/^\s*rg\b/,
	/^\s*fd\b/,
	/^\s*bat\b/,
	/^\s*eza\b/,
];

const EVALUATOR_SAFE_PATTERNS = [
	/^\s*git(?:\s+-C\s+(?:"[^"]+"|'[^']+'|[^\s;&|<>`$()]+))?\s+(status|log|diff|show|branch|remote|config\s+--get|ls-(files|tree|remote)|worktree\s+list)\b/i,
	/^\s*clang-format\b(?=.*(?:^|\s)--dry-run(?:\s|$))(?=.*(?:^|\s)--Werror(?:\s|$))(?!.*(?:^|\s)-i(?:\s|$))/i,
	/^\s*systemd-analyze\s+verify\b/i,
	/^\s*npm\s+(test|run\s+(build|lint|typecheck|check))\b/i,
	/^\s*(pytest|ctest)\b/i,
	/^\s*colcon\s+(test|build)\b/i,
];

const LEADING_CD_PATTERN =
	/^\s*cd\s+(?:"[^"]+"|'[^']+'|[^\s;&|<>`$()]+)\s*&&\s*/;

function stripReadOnlyPreamble(command: string): string {
	let normalized = command.trim();

	while (LEADING_CD_PATTERN.test(normalized)) {
		normalized = normalized.replace(LEADING_CD_PATTERN, "");
	}

	return normalized;
}

function isSafeCommand(command: string, modeName?: string): boolean {
	const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
	if (isDestructive) return false;

	const normalized = stripReadOnlyPreamble(command);
	const safePatterns =
		modeName === "evaluator"
			? [...SAFE_PATTERNS, ...EVALUATOR_SAFE_PATTERNS]
			: SAFE_PATTERNS;

	return safePatterns.some((p) => p.test(normalized));
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Mode {
  name: string;
  description: string;
  tools: string[]; // "all" means unrestricted
  prompt: string;
  sourcePath: string;
  model?: string;
  thinkingLevel?: string;
}

interface ParsedFrontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

interface AgentModeEntry {
  type: "custom";
  customType: "agent-mode";
  data: { mode: string | null };
}

// ─── Minimal YAML frontmatter parser ──────────────────────────────────────────

function parseFrontmatter(raw: string): ParsedFrontmatter {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }
  const end = raw.indexOf("---", 3);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }
  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 3).trimStart();
  const frontmatter: Record<string, string> = {};

  for (const line of fmBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// ─── Mode discovery ────────────────────────────────────────────────────────────

function discoverModes(cwd: string): Mode[] {
  const modes: Mode[] = [];
  const seen = new Set<string>();
  const dirs: string[] = [];

  // Project-local
  dirs.push(path.join(cwd, ".pi", "modes"));

  // Parent directories up to git root
  let searchDir = cwd;
  while (true) {
    const dir = path.join(searchDir, ".pi", "modes");
    if (!dirs.includes(dir)) dirs.push(dir);
    if (fs.existsSync(path.join(searchDir, ".git"))) break;
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }

  // Global
  dirs.push(path.join(os.homedir(), ".pi", "agent", "modes"));

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      const sourcePath = path.join(dir, entry);
      let raw: string;
      try {
        raw = fs.readFileSync(sourcePath, "utf-8");
      } catch {
        continue;
      }
      const { frontmatter, body } = parseFrontmatter(raw);
      const name = (frontmatter.name ?? path.basename(entry, ".md")).trim();
      if (seen.has(name)) continue;
      seen.add(name);

      const toolsRaw = (frontmatter.tools ?? "").trim();
      const tools =
        toolsRaw === "all"
          ? ["all"]
          : toolsRaw.split(/\s+/).filter(Boolean);

      modes.push({
        name,
        description: frontmatter.description ?? `Agent mode: ${name}`,
        tools,
        prompt: body,
        sourcePath,
        model: frontmatter.model,
        thinkingLevel: frontmatter["thinking-level"],
      });
    }
  }

  return modes;
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let modes: Mode[] = [];
  let activeMode: Mode | null = null;

  function refreshModes(cwd: string) {
    modes = discoverModes(cwd);
  }

  function toolNames(): string[] {
    return pi.getAllTools().map((t) => t.name);
  }

  async function setMode(ctx: ExtensionContext, name: string | null) {
    if (name === null) {
      activeMode = null;
      pi.setActiveTools(toolNames());
      ctx.ui.setStatus("mode", "");
      ctx.ui.setWidget("mode", []);
      pi.appendEntry("agent-mode", { mode: null });
      return;
    }

    const mode = modes.find((m) => m.name === name);
    if (!mode) {
      ctx.ui.notify(`Mode "${name}" not found`, "error");
      return;
    }

    activeMode = mode;

    // Apply model if specified
    if (mode.model) {
      const slashIdx = mode.model.indexOf("/");
      if (slashIdx > 0) {
        const provider = mode.model.slice(0, slashIdx);
        const modelId = mode.model.slice(slashIdx + 1);
        const resolved = ctx.modelRegistry.find(provider, modelId);
        if (resolved) {
          const success = await pi.setModel(resolved);
          if (!success) {
            ctx.ui.notify(`Mode "${name}": No API key for ${provider}/${modelId}`, "warning");
          }
        } else {
          ctx.ui.notify(`Mode "${name}": Model ${provider}/${modelId} not found`, "warning");
        }
      } else {
        ctx.ui.notify(`Mode "${name}": Invalid model format "${mode.model}" (expected provider/id)`, "warning");
      }
    }

    // Apply thinking level if specified
    if (mode.thinkingLevel) {
      pi.setThinkingLevel(mode.thinkingLevel as any);
    }

    // Enforce tool authorizations
    const all = toolNames();
    if (mode.tools.includes("all")) {
      pi.setActiveTools(all);
    } else {
      const allowed = mode.tools.filter((t) => all.includes(t));
      if (allowed.length === 0) {
        ctx.ui.notify(
          `Mode "${name}" has no valid tools — all tools remain active`,
          "warning"
        );
      } else {
        pi.setActiveTools(allowed);
      }
    }

    // Persist in session
    pi.appendEntry("agent-mode", { mode: name });

    // Update UI
    ctx.ui.setStatus("mode", name);
    ctx.ui.setWidget("mode", [
      `mode: ${name} — ${mode.description}`,
      `tools: ${mode.tools.includes("all") ? "all" : mode.tools.join(", ")}`,
    ]);
    ctx.ui.notify(`Mode: ${name}${mode.model ? ` — ${mode.model}` : ""}${mode.thinkingLevel ? ` @ ${mode.thinkingLevel}` : ""}`, "info");
  }

  // ─── Commands ──────────────────────────────────────────────────────────────

  pi.registerCommand("mode", {
    description: "Set agent mode (or omit name to show current)",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const items = modes
        .filter((m) => m.name.startsWith(prefix))
        .map((m) => ({ value: m.name, label: m.description }));
      return items.length > 0 ? items : null;
    },
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        if (activeMode) {
          const tools = activeMode.tools.includes("all")
            ? "all"
            : activeMode.tools.join(", ");
          ctx.ui.notify(`${activeMode.name} (${tools})`, "info");
        } else {
          ctx.ui.notify("No active mode (all tools)", "info");
        }
        return;
      }
      await setMode(ctx, trimmed);
    },
  });

  pi.registerCommand("modes", {
    description: "List available agent modes",
    handler: async (_args, ctx) => {
      if (modes.length === 0) {
        ctx.ui.notify("No modes found", "info");
        return;
      }
      const lines = modes.map((m) => {
        const mark = m.name === activeMode?.name ? "●" : " ";
        return `${mark} ${m.name} — ${m.description}`;
      });
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("reset-mode", {
    description: "Clear active mode (restore all tools)",
    handler: async (_args, ctx) => {
      await setMode(ctx, null);
      ctx.ui.notify("Mode cleared", "info");
    },
  });

  // ─── CLI flag ───────────────────────────────────────────────────────────────

  pi.registerFlag("agent-mode", {
    description: "Start pi in a specific agent mode",
    type: "string",
    default: "",
  });

  // ─── Keyboard shortcut ─────────────────────────────────────────────────────

  pi.registerShortcut(Key.ctrlShift("m"), {
    description: "Cycle agent modes",
    handler: async (ctx) => {
      if (modes.length === 0) return;
      const idx = activeMode ? modes.findIndex((m) => m.name === activeMode.name) : -1;
      const next = (idx + 1) % (modes.length + 1);
      await setMode(ctx, next < modes.length ? modes[next].name : null);
    },
  });

  // ─── Events ────────────────────────────────────────────────────────────────

  pi.on("session_start", async (event, ctx) => {
    refreshModes(ctx.cwd);

    // Apply --agent-mode CLI flag on fresh startup (not resume/fork/reload)
    const flagMode = pi.getFlag("agent-mode");
    if (typeof flagMode === "string" && flagMode && (event.reason === "startup" || event.reason === "new")) {
      await setMode(ctx, flagMode);
      return;
    }

    // Restore mode from session entries
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (
        entry.type === "custom" &&
        (entry as AgentModeEntry).customType === "agent-mode"
      ) {
        const modeName = (entry as AgentModeEntry).data.mode;
        if (modeName) {
          await setMode(ctx, modeName);
        }
        break;
      }
    }
  });

  // Block destructive bash commands in read-only modes (modes that include
  // bash but exclude write/edit)
  pi.on("tool_call", async (event) => {
    if (!activeMode || event.toolName !== "bash") return;

    const hasWrite = activeMode.tools.includes("all") || activeMode.tools.includes("write");
    const hasEdit = activeMode.tools.includes("all") || activeMode.tools.includes("edit");
    if (hasWrite && hasEdit) return; // Full access mode — no bash restriction

    if (!isToolCallEventType("bash", event)) return;
    const command = event.input.command as string;
    if (!isSafeCommand(command, activeMode.name)) {
      return {
        block: true,
        reason: `${activeMode.name} mode: destructive bash command blocked.\nNext step if you want to implement: switch to generator mode with /mode generator.\nUse /reset-mode only to clear the current mode and restore defaults.\nCommand: ${command}`,
      };
    }
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!activeMode) return {};

    const shaping = activeMode.prompt.trim();
    if (!shaping) return {};

    const header = `## AGENT MODE: ${activeMode.name.toUpperCase()}`;
    const injection = shaping
      ? `\n\n${header}\n\n${shaping}`
      : `\n\n${header}`;

    return { systemPrompt: event.systemPrompt + injection };
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    activeMode = null;
  });
}
