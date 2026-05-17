#!/usr/bin/env bun
import { Crawler, createLogger, PerplexityProvider } from "../src/index";

const QUERY =
  process.env.QUERY ??
  "What are the best authentication libraries for Next.js in 2026?";

const TARGET_BRAND = process.env.TARGET_BRAND ?? "better-auth";

const KNOWN_COMPETITORS = [
  { name: "Clerk", domain: "clerk.com" },
  { name: "Auth.js", domain: "authjs.dev" },
  { name: "Lucia Auth", domain: "lucia-auth.com" },
].filter((c) => c.name.toLowerCase() !== TARGET_BRAND.toLowerCase());

const SYSTEM_PROMPT = `You are an AI competitive intelligence analyst. Your job is to analyze AI-generated responses and extract brand mentions with precise classification.

Rules:
- Be precise with brand names. Extract the actual brand/company name, not generic terms.
- "target" = the brand the user is tracking (their own brand)
- "competitor" = any brand that competes with the target in the context of this query
- "other" = brands mentioned that are not competitors (e.g., platforms, tools, infrastructure)
- isRecommendation = true if the response recommends or endorses the brand
- objection = any negative sentiment, criticism, or caveat about the brand (null if none)
- For brandUrl, extract from context if available, or infer the most likely domain (e.g., "Clerk" → "clerk.com")
- Do NOT include generic terms like "OAuth", "MFA", "API", "Next.js" as brands
- Do NOT include the query itself or section headings as brands
- Only include brands that are actually mentioned in the content

CRITICAL: discoveredCompetitors must include EVERY brand you classified as "competitor" that is NOT in the known competitors list provided below. This is how new competitors are discovered. Do NOT omit them.

CRITICAL: For domain fields, NEVER return null. If no URL is mentioned, infer the most likely domain (e.g., "Auth0" → "auth0.com", "Supabase Auth" → "supabase.com", "Firebase Authentication" → "firebase.google.com"). Always return a string.`;

function buildUserPrompt(
  content: string,
  query: string,
  targetBrand: string,
  knownCompetitors: Array<{ name: string; domain: string }>,
): string {
  const knownCompetitorsList =
    knownCompetitors.length > 0
      ? knownCompetitors.map((c) => `- ${c.name} (${c.domain})`).join("\n")
      : "(none)";

  return `Analyze the following AI response to the query: "${query}"

Target brand being tracked: ${targetBrand}

Known competitors (do NOT include these in discoveredCompetitors):
${knownCompetitorsList}

---
CONTENT:
${content}
---

Return a JSON object with this exact structure:
{
  "brandMentions": [
    {
      "brandName": "string",
      "brandUrl": "string or null",
      "context": "the surrounding sentence or paragraph where the brand is mentioned",
      "mentionType": "target" | "competitor" | "other",
      "isRecommendation": boolean,
      "objection": "string or null"
    }
  ],
  "discoveredCompetitors": [
    {
      "name": "EXACT brandName from brandMentions where mentionType is 'competitor' AND not in known list",
      "domain": "inferred or extracted domain"
    }
  ],
  "answerFormat": "numbered_list" | "paragraph" | "comparison_table" | "conversational" | "unknown"
}

IMPORTANT: For discoveredCompetitors, look at every brandMention with mentionType="competitor". If that brand is NOT in the known competitors list above, add it to discoveredCompetitors. This is critical for competitor discovery.

IMPORTANT: NEVER return null for domain fields. If no URL is mentioned in the content, infer the most likely domain (e.g., "Auth0" → "auth0.com", "Supabase Auth" → "supabase.com"). Always return a valid domain string.`;
}

function parseLlmResponse(response: string) {
  let cleaned = response.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  return JSON.parse(cleaned);
}

async function callLlm(prompt: string): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "local-model";

  if (!baseUrl) {
    throw new Error("LLM_BASE_URL environment variable is not set");
  }

  logger.info(`Calling LLM at ${baseUrl} with model ${model}...`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey ?? ""}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM API call failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("LLM returned empty response");
  }

  return data.choices[0].message.content;
}

const logger = createLogger("info");

async function main() {
  const crawler = new Crawler({ logger });
  const provider = new PerplexityProvider();

  logger.info("=" .repeat(60));
  logger.info("STEP 1: CRAWLING PERPLEXITY");
  logger.info("=" .repeat(60));
  logger.info(`Query: ${QUERY}`);
  logger.info(`Target Brand: ${TARGET_BRAND}`);
  logger.info(`Known Competitors: ${KNOWN_COMPETITORS.map((c) => c.name).join(", ")}`);
  logger.info("");

  try {
    const result = await crawler.crawl({
      query: QUERY,
      provider,
      browserOptions: {
        headless: true,
      },
    });

    logger.info("Crawl completed");
    logger.info(`Content length: ${result.content.length} chars`);
    logger.info(`Citations: ${result.structured?.citations.length ?? 0}`);
    logger.info("");

    logger.info("=" .repeat(60));
    logger.info("STEP 2: LLM BRAND INTELLIGENCE EXTRACTION");
    logger.info("=" .repeat(60));
    logger.info("");

    const prompt = buildUserPrompt(
      result.content,
      QUERY,
      TARGET_BRAND,
      KNOWN_COMPETITORS,
    );

    const rawResponse = await callLlm(prompt);
    const intelligence = parseLlmResponse(rawResponse);

    logger.info("=" .repeat(60));
    logger.info("RESULTS");
    logger.info("=" .repeat(60));

    logger.info("\n1️⃣  BRAND MENTIONS:");
    logger.info(`   Count: ${intelligence.brandMentions.length}`);
    logger.info("");

    for (const mention of intelligence.brandMentions) {
      const typeEmoji =
        mention.mentionType === "target"
          ? "🎯"
          : mention.mentionType === "competitor"
            ? "⚔️"
            : "📌";
      const recBadge = mention.isRecommendation ? " ✅ Recommended" : "";
      const objBadge = mention.objection ? ` ⚠️ "${mention.objection}"` : "";

      logger.info(`   ${typeEmoji} ${mention.brandName} (${mention.mentionType})${recBadge}${objBadge}`);
      logger.info(`      URL: ${mention.brandUrl ?? "(none)"}`);
      logger.info(`      Context: ${mention.context.substring(0, 120)}...`);
      logger.info("");
    }

    logger.info("\n2️⃣  DISCOVERED COMPETITORS:");
    logger.info(`   Count: ${intelligence.discoveredCompetitors.length}`);
    for (const comp of intelligence.discoveredCompetitors) {
      logger.info(`   ⚔️ ${comp.name} → ${comp.domain}`);
    }

    logger.info("\n3️⃣  ANSWER FORMAT:");
    logger.info(`   ${intelligence.answerFormat}`);

    logger.info("\n" + "=" .repeat(60));
    logger.info("RAW JSON OUTPUT");
    logger.info("=" .repeat(60));
    logger.info(JSON.stringify(intelligence, null, 2));
  } catch (error) {
    logger.error("Test failed:", error);
    process.exit(1);
  }
}

main();
