// The AI SDK call. This agent has no tool dependencies — design.json declares
// no component-kind dependency and agent.afm.md's front matter carries no
// x-aep.tools.openapi — so there is no tool loop and no src/tools.ts to
// generate. Every turn is one structured-output call: classify the ticket's
// urgency and draft a reply, enforced by a zod schema rather than by hoping
// the model formats prose correctly.

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { config } from "./config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { tracer } from "./tracing.js";

const TriageResult = z.object({
  urgency: z.enum(["Low", "Medium", "High", "Critical"]),
  draftReply: z.string(),
});

export type TriageObject = z.infer<typeof TriageResult>;

function modelClient() {
  const keyHeader = config.modelApiKeyHeader;
  const anthropic = createAnthropic(
    keyHeader
      ? {
          baseURL: config.modelEndpoint,
          apiKey: "unused",
          headers: { [keyHeader]: config.modelApiKey ?? "" },
        }
      : { baseURL: config.modelEndpoint, apiKey: config.modelApiKey },
  );
  return anthropic(config.modelName);
}

export interface TurnResult {
  object: TriageObject;
  assistantMessage: ModelMessage;
}

// Runs one turn: history plus the caller's new message go in; a validated
// { urgency, draftReply } object comes out, along with the assistant message
// to append to the stored conversation (its content is the JSON string the
// caller's /chat response also returns as `text`).
export async function runTurn(messages: ModelMessage[]): Promise<TurnResult> {
  const model = modelClient();

  const result = await tracer.startActiveSpan(`chat ${config.modelName}`, async (span) => {
    try {
      const r = await generateObject({
        model,
        system: SYSTEM_PROMPT,
        schema: TriageResult,
        messages,
      });
      span.setAttributes({
        "gen_ai.system": "anthropic",
        "gen_ai.request.model": config.modelName,
        "gen_ai.usage.input_tokens": r.usage?.inputTokens ?? 0,
        "gen_ai.usage.output_tokens": r.usage?.outputTokens ?? 0,
      });
      return r;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2 }); // ERROR
      throw err;
    } finally {
      span.end(); // a span never ended is a span never exported
    }
  });

  const content = JSON.stringify(result.object);
  return {
    object: result.object,
    assistantMessage: { role: "assistant", content },
  };
}
