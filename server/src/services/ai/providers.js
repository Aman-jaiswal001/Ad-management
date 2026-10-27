import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { env } from "../../config/env.js";
import { llmFindingSchema } from "../../validators/schemas.js";
import { FINDING_CATEGORIES } from "../../config/constants.js";

const TRANSIENT = /timeout|429|503|502|ECONNRESET|fetch failed|overloaded|unavailable/i;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export function groqConfigured() {
  return Boolean(env.groqApiKey);
}

export function geminiConfigured() {
  return Boolean(env.geminiApiKey);
}

export function createGroqChat() {
  if (!env.groqApiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }
  return new ChatGroq({
    apiKey: env.groqApiKey,
    model: env.groqModel,
    temperature: 0,
    maxRetries: 0,
  });
}

export function createGeminiChat() {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new ChatGoogleGenerativeAI({
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
    temperature: 0,
    maxRetries: 0,
  });
}

async function invokeJson(chat, system, user, label) {
  const response = await withTimeout(
    chat.invoke([new SystemMessage(system), new HumanMessage(user)]),
    env.llmTimeoutMs,
    label
  );
  const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const json = extractJson(text);
  const parsed = llmFindingSchema.safeParse(normalizeFindingPayload(json));
  if (!parsed.success) {
    // Include a compact validation reason so provider failures are actionable.
    const details = parsed.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Model output failed schema validation${details ? `: ${details}` : "."}`);
  }
  const usage = response.usage_metadata || response.response_metadata?.tokenUsage || {};
  return {
    findings: parsed.data.findings,
    tokenUsage: {
      prompt: usage.input_tokens || usage.promptTokens || 0,
      completion: usage.output_tokens || usage.completionTokens || 0,
    },
  };
}

export function extractJson(text) {
  // LangChain may return content as an array of text blocks. Keep non-text
  // parts out of the JSON parser rather than serializing their wrapper object.
  if (Array.isArray(text)) {
    text = text
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .filter(Boolean)
      .join("\n");
  }
  const cleaned = String(text)
    .replace(/```json/gi, "```")
    .trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : cleaned;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeFindingPayload(payload) {
  if (!payload || !Array.isArray(payload.findings)) return payload;
  const categoryAliases = {
    tone: "brand_tone_voice",
    brand_tone: "brand_tone_voice",
    tone_of_voice: "brand_tone_voice",
    product_name: "incorrect_product_names",
    terminology: "inconsistent_terminology",
    unsupported_claim: "unsupported_claims",
    outdated_fact: "outdated_facts",
    disclaimer: "missing_disclaimers",
    absolute_claim: "absolute_exaggerated_claims",
    accessibility_issue: "accessibility",
    brand_rule: "brand_rule_violation",
  };
  const issueKindAliases = {
    confirmed_violation: "confirmed_rule_violation",
    rule_violation: "confirmed_rule_violation",
    possible_issue: "potential_issue",
    verification_needed: "needs_verification",
    needs_human_judgment: "human_judgment_required",
  };
  return {
    ...payload,
    findings: payload.findings.map((finding) => {
      if (!finding || typeof finding !== "object" || Array.isArray(finding)) return finding;
      const categoryValue = String(finding.category || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
      const category = categoryAliases[categoryValue] || categoryValue;
      const issueValue = String(finding.issueKind || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
      const severityValue = String(finding.severity || "").toLowerCase().trim();
      const severity = ["low", "medium", "high", "critical"].includes(severityValue)
        ? severityValue[0].toUpperCase() + severityValue.slice(1)
        : finding.severity;
      const sourceIds = finding.sourceIds ?? finding.source_ids ?? finding.sourceReferences;
      return {
        ...finding,
        ...(FINDING_CATEGORIES.includes(category) ? { category } : {}),
        ...(severity ? { severity } : {}),
        ...(issueValue ? { issueKind: issueKindAliases[issueValue] || issueValue } : {}),
        ...(sourceIds !== undefined ? { sourceIds } : {}),
      };
    }),
  };
}

export async function generateStructuredFindings({ system, user, invokeProvider }) {
  if (invokeProvider) {
    return invokeProvider({ system, user });
  }

  const attempts = [];
  if (groqConfigured()) attempts.push({ name: "groq", factory: createGroqChat });
  if (geminiConfigured()) attempts.push({ name: "gemini", factory: createGeminiChat });

  if (!attempts.length) {
    const err = new Error(
      "No LLM provider is configured. Set GROQ_API_KEY and/or GEMINI_API_KEY."
    );
    err.status = 503;
    err.code = "PROVIDER_CONFIG";
    throw err;
  }

  let lastError;
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    for (let retry = 0; retry <= env.llmMaxRetries; retry += 1) {
      try {
        const chat = attempt.factory();
        const result = await invokeJson(chat, system, user, attempt.name);
        return {
          ...result,
          providerUsed: attempt.name,
          fallbackUsed: i > 0,
        };
      } catch (err) {
        lastError = err;
        const message = err.message || String(err);
        const configError = /api[_ ]?key|not configured|invalid|PERMISSION|401|403/i.test(message);
        if (configError) {
          err.status = 503;
          err.code = "PROVIDER_CONFIG";
          throw err;
        }
        const transient = TRANSIENT.test(message);
        if (!transient) break;
      }
    }
  }

  const err = new Error(
    `All LLM providers failed. Last error: ${lastError?.message || "unknown"}`
  );
  err.status = 503;
  err.code = "PROVIDERS_UNAVAILABLE";
  throw err;
}

export const __test__ = { extractJson, TRANSIENT };
