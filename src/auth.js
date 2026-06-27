import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input } from "node:process";
import {
  AuthStorage,
  ModelRegistry,
} from "@earendil-works/pi-coding-agent";

const AUTH_ERROR_PATTERNS = [
  /no api key found/i,
  /api key.*(invalid|missing|not found|required)/i,
  /authentication/i,
  /unauthori[sz]ed/i,
  /permission denied/i,
  /invalid.*token/i,
  /expired.*token/i,
  /\b401\b/,
  /\b403\b/,
];

function openExternal(target) {
  const [command, args] = process.platform === "darwin"
    ? ["open", [target]]
    : process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", target]]
      : ["xdg-open", [target]];

  spawn(command, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}

export function isAuthError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function createQuestioner() {
  return readline.createInterface({ input, output: process.stderr });
}

async function askText(question, { allowEmpty = false, signal } = {}) {
  const rl = createQuestioner();
  try {
    while (true) {
      const answer = await rl.question(question, signal ? { signal } : undefined);
      if (allowEmpty || answer.trim()) return answer;
      console.error("A value is required.");
    }
  } finally {
    rl.close();
  }
}

async function askHidden(question) {
  if (!process.stdin.isTTY) return askText(question);

  const wasRaw = process.stdin.isRaw;
  process.stdin.resume();
  process.stdin.setRawMode?.(true);
  let value = "";
  process.stderr.write(question);

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(wasRaw ?? false);
      process.stderr.write("\n");
    };

    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      for (const char of text) {
        const code = char.charCodeAt(0);
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (code === 3) {
          cleanup();
          reject(new Error("Login cancelled"));
          return;
        }
        if (code === 127 || code === 8) {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    process.stdin.on("data", onData);
  });
}

function getProviderOptions(modelRegistry) {
  const authStorage = modelRegistry.authStorage;
  const oauthProviders = authStorage.getOAuthProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    authType: "oauth",
  }));
  const oauthIds = new Set(oauthProviders.map((provider) => provider.id));
  const modelProviders = new Set(modelRegistry.getAll().map((model) => model.provider));
  const apiKeyProviders = [...modelProviders]
    .filter((provider) => !oauthIds.has(provider))
    .map((provider) => ({
      id: provider,
      name: modelRegistry.getProviderDisplayName(provider),
      authType: "api_key",
    }));

  return [...oauthProviders, ...apiKeyProviders].sort((a, b) => a.name.localeCompare(b.name));
}

async function selectProvider(modelRegistry) {
  const options = getProviderOptions(modelRegistry);
  if (options.length === 0) throw new Error("No login providers available.");

  console.error("Select a provider to log in:");
  options.forEach((option, index) => {
    const kind = option.authType === "oauth" ? "OAuth" : "API key";
    console.error(`  ${index + 1}. ${option.name} (${option.id}, ${kind})`);
  });

  while (true) {
    const answer = (await askText("Provider number or id: ")).trim();
    const byIndex = Number(answer);
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= options.length) {
      return options[byIndex - 1];
    }

    const byId = options.find((option) => option.id === answer);
    if (byId) return byId;

    console.error("Unknown provider. Try again.");
  }
}

function getProviderOption(modelRegistry, providerId) {
  return getProviderOptions(modelRegistry).find((option) => option.id === providerId);
}

function formatAuthSource(status) {
  if (!status.configured) return "not configured";
  return status.label ? `${status.source} (${status.label})` : status.source;
}

function printTable(rows) {
  const headers = ["Provider", "Name", "Type", "Source"];
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const formatRow = (row) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd();

  console.log(formatRow(headers));
  console.log(formatRow(widths.map((width) => "-".repeat(width))));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

async function loginWithApiKey(authStorage, providerOption) {
  const apiKey = (await askHidden(`Enter API key for ${providerOption.name}: `)).trim();
  if (!apiKey) throw new Error("API key cannot be empty.");
  authStorage.set(providerOption.id, { type: "api_key", key: apiKey });
  console.error(`Saved API key for ${providerOption.name}.`);
}

async function loginWithOAuth(authStorage, providerOption) {
  const manualInputAbort = new AbortController();
  try {
    await authStorage.login(providerOption.id, {
      onAuth: (info) => {
        console.error(info.instructions || "Complete login in your browser.");
        console.error(info.url);
        openExternal(info.url);
      },
      onDeviceCode: (info) => {
        console.error(`Open: ${info.verificationUri}`);
        console.error(`Code: ${info.userCode}`);
        openExternal(info.verificationUri);
      },
      onPrompt: async (prompt) => {
        const suffix = prompt.placeholder ? ` (${prompt.placeholder})` : "";
        return askText(`${prompt.message}${suffix}: `, { allowEmpty: prompt.allowEmpty === true });
      },
      onProgress: (message) => {
        console.error(message);
      },
      onManualCodeInput: async () => {
        return askText("Paste redirect URL/code, or press Enter after completing login in the browser: ", {
          allowEmpty: true,
          signal: manualInputAbort.signal,
        });
      },
      onSelect: async (prompt) => {
        console.error(prompt.message);
        prompt.options.forEach((option, index) => {
          console.error(`  ${index + 1}. ${option.label} (${option.id})`);
        });
        const answer = (await askText("Selection number or id: ")).trim();
        const byIndex = Number(answer);
        if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= prompt.options.length) {
          return prompt.options[byIndex - 1].id;
        }
        return prompt.options.find((option) => option.id === answer)?.id;
      },
    });
  } finally {
    manualInputAbort.abort();
  }
  console.error(`Logged in to ${providerOption.name}.`);
}

export async function loginProvider(providerId) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error("Login requires an interactive terminal.");
  }

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const providerOption = providerId ? getProviderOption(modelRegistry, providerId) : await selectProvider(modelRegistry);

  if (!providerOption) {
    throw new Error(`Unknown login provider: ${providerId}`);
  }

  if (providerOption.authType === "oauth") {
    await loginWithOAuth(authStorage, providerOption);
  } else {
    await loginWithApiKey(authStorage, providerOption);
  }

  modelRegistry.refresh();
  return providerOption;
}

export function printAuthStatus(providerId) {
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const options = getProviderOptions(modelRegistry);
  const selectedOptions = providerId ? options.filter((option) => option.id === providerId) : options;

  if (providerId && selectedOptions.length === 0) {
    throw new Error(`Unknown auth provider: ${providerId}`);
  }

  if (selectedOptions.length === 0) {
    console.log("No auth providers available.");
    return;
  }

  const rows = [];
  for (const option of selectedOptions) {
    const status = modelRegistry.getProviderAuthStatus(option.id);
    if (!status.configured) continue;

    const kind = option.authType === "oauth" ? "OAuth" : "API key";
    rows.push([option.id, option.name, kind, formatAuthSource(status)]);
  }

  if (rows.length === 0) {
    console.log(providerId ? `No auth configured for ${providerId}.` : "No auth configured.");
    return;
  }

  printTable(rows);
}

function providerFromAuthError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/No API key found for\s+"?([^".\n]+)"?/i);
  return match?.[1]?.trim();
}

export async function confirmLoginAfterAuthError(providerId, error) {
  const resolvedProviderId = providerId || providerFromAuthError(error);
  if (!resolvedProviderId || !isAuthError(error) || !process.stdin.isTTY || !process.stderr.isTTY) {
    return false;
  }

  console.error("\nAuthentication failed for the selected model provider.");
  const answer = (await askText(`Log in to ${resolvedProviderId} now and retry? [Y/n] `, { allowEmpty: true })).trim().toLowerCase();
  if (answer && answer !== "y" && answer !== "yes") return false;

  await loginProvider(resolvedProviderId);
  return true;
}
