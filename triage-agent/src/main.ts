import "./tracing.js"; // side effects only; import before any model client

import http from "node:http";
import crypto from "node:crypto";
import type { ModelMessage } from "ai";
import { config, missingRequiredEnv } from "./config.js";
import { initStore, ensureStore, isStoreReady, loadConversation, saveConversation } from "./store.js";
import { runTurn } from "./agent.js";

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Reads the AI SDK's APICallError body; returns null for anything else.
function guardrailBlock(err: unknown): { name: string; reason: string } | null {
  const body = (err as { responseBody?: string })?.responseBody;
  if (!body) return null;
  try {
    const m = (JSON.parse(body) as { message?: Record<string, unknown> })?.message;
    if (!m || m.action !== "GUARDRAIL_INTERVENED") return null;
    return {
      name: (m.interveningGuardrail as string) ?? "guardrail",
      reason: (m.actionReason as string) ?? "refused by policy",
    };
  } catch {
    return null;
  }
}

async function handleChat(userId: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    sendJson(res, 400, { error: "expected a JSON body" });
    return;
  }

  const body = parsed as { conversationId?: unknown; message?: unknown };

  if (typeof body.message !== "string" || body.message.trim() === "") {
    sendJson(res, 400, { error: "expected { message: string }" });
    return;
  }
  const message = body.message;

  if (body.conversationId !== undefined && typeof body.conversationId !== "string") {
    sendJson(res, 400, { error: "conversationId must be a string when present" });
    return;
  }

  await ensureStore();

  let id: string;
  let history: ModelMessage[];

  if (typeof body.conversationId === "string") {
    const loaded = await loadConversation(body.conversationId, userId);
    if (loaded === null) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    id = body.conversationId;
    history = loaded;
  } else {
    id = crypto.randomUUID();
    history = [];
  }

  const full: ModelMessage[] = [...history, { role: "user", content: message }];

  let turn: Awaited<ReturnType<typeof runTurn>>;
  try {
    turn = await runTurn(full);
  } catch (err) {
    const g = guardrailBlock(err);
    if (g) {
      sendJson(res, 422, { error: g.reason, guardrail: g.name });
      return;
    }
    console.error("chat turn failed:", err);
    sendJson(res, 500, { error: "internal error" });
    return;
  }

  await saveConversation(id, userId, [...full, turn.assistantMessage]);

  const text = JSON.stringify(turn.object);
  sendJson(res, 200, { conversationId: id, text, toolCalls: [] });
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/healthz") {
    const missing = missingRequiredEnv();
    const store = isStoreReady() ? "ready" : "initialising";
    if (missing.length > 0 || store !== "ready") {
      sendJson(res, 503, { ok: false, missing, store });
    } else {
      sendJson(res, 200, { ok: true });
    }
    return;
  }

  if (req.method === "POST" && url === "/chat") {
    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || userId === "") {
      res.statusCode = 401;
      res.end();
      return;
    }
    await handleChat(userId, req, res);
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  void handle(req, res).catch((err) => {
    console.error("request failed:", err);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.destroy();
  });
});

// Fire-and-forget: the store may not be reachable yet (postgres-cnpg
// provisions asynchronously). Never awaited before listen — see
// references/building.md, "Never await initStore() before listen()".
initStore();

server.listen(config.port);
