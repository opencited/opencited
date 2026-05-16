# AI Visibility Tracking — Implementation Plan

> **For:** opencode · **Scope:** packages/browser-crawler, packages/trigger, packages/db, packages/trpc, apps/web · **Phase:** 1 (MVP)

---

## 1. What This Feature Does

A user adds their brand (via `domainProject`) and tracking prompts. The system manually triggers crawls against AI providers (starting with Perplexity), extracts structured signals from every answer, stores them, and surfaces analytics that answer: *"When someone asks an AI about my niche, how visible is my brand — and why?"*

**Scope for Phase 1:** Manual single-prompt crawls only. No scheduling, no batches.

---

## 2. Core Terminology

| Term | Definition |
|---|---|
| **Domain Project** | The user's brand entity. 1:1:1 mapping: org → domainProject → brand. All tracking data links to `domainProjectId`. |
| **Prompt** | A natural language query submitted to AI providers. Stored in `promptQueryTable`. |
| **Provider** | An AI answer engine being queried. Initial: Perplexity. Future: ChatGPT, Gemini, Grok, Claude. |
| **Run** | A single execution of one prompt against one provider. Produces one raw answer + structured signals. |
| **Visibility Score** | Composite 0–100 score (Phase 2). Computed from mention rate, position, citation rate, sentiment. |
| **Mention** | Detection of a brand name (or alias) inside a provider's answer text. |
| **Position Rank** | Ordinal position of a brand's first mention relative to other brands. Position 1 = mentioned first. |
| **Snippet** | ±200 character context window around the brand mention. Stored verbatim. |
| **Sentiment** | LLM-classified tone: `positive`, `neutral`, or `negative`. |
| **Citation** | A source URL the provider included in its answer. |
| **Citation Gap** | A domain frequently cited for tracked prompts but never from the user's own domain. |
| **Share of Voice** | Proportion of answers in which the brand is mentioned, relative to all brands mentioned. |

---

## 3. Three Layers of Extracted Data

Every run produces data across three distinct layers mapping to separate DB tables.

### Layer 1 — Run Metadata
Infrastructure-level data about the crawl execution.

Fields:
- Provider identifier
- Prompt text (snapshotted at run time)
- Status: `pending`, `running`, `completed`, `failed`
- Duration in milliseconds
- Error message if failed
- Raw answer text (full, unprocessed)
- Answer word count
- Answer format: `numbered_list`, `paragraph`, `comparison_table`, `conversational`, `unknown`
- Number of source URLs cited

### Layer 2 — Brand Signals
Structured signals extracted from the raw answer relating to the tracked brand.

Fields per run per brand:
- Whether the brand was mentioned (boolean)
- How many times the brand (or any alias) appeared
- Position rank of first mention (integer, null if not mentioned)
- Relative position category: `first`, `early`, `middle`, `late`, `not_mentioned`
- Snippet (verbatim ±200 char context window around first mention)
- Sentiment of the snippet: `positive`, `neutral`, `negative`
- Whether a recommendation was detected (boolean)
- Objection text (nullable) — negative phrase detected near mention

### Layer 3 — Citation Signals
Every source URL the provider cited. One row per citation per run.

Fields per citation:
- Full source URL
- Domain extracted from URL
- Ordinal position in source list (position 1 is strongest)
- Whether this URL belongs to the tracked brand's domain (boolean)
- Whether this URL belongs to a tracked competitor's domain (boolean)

---

## 4. Database Schema

### Architecture Rule
**One organization = One domainProject = One brand**
- All feature tables reference `domainProjectId`
- Do NOT create separate `brand` tables
- Do NOT link to `clerkOrganizationId` for feature data

### Tables to Create (4 new tables)

#### 4.1 `competitor` Table
Track competitor domains for citation gap analysis & share of voice.

```typescript
// packages/db/src/schema/competitor.ts

export const competitorTable = pgTable("competitor", {
  id: id,
  domainProjectId: text("domain_project_id").notNull()
    .references(() => domainProjectTable.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),           // "Jotform"
  domain: text("domain").notNull(),       // "jotform.com"
  active: text("active").notNull().default("true"),
  
  createdAt: createdAt,
  updatedAt: updatedAt,
});
```

#### 4.2 `crawlSource` Table
Store each source/citation from a crawl result.

```typescript
// packages/db/src/schema/crawlSource.ts

export const crawlSourceTable = pgTable("crawl_source", {
  id: id,
  crawlId: text("crawl_id").notNull()
    .references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),
  
  // Core source info
  domain: text("domain").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  position: integer("position"),
  
  // Classification
  isOwnDomain: text("is_own_domain").notNull().default("false"),
  isCompetitorDomain: text("is_competitor_domain").notNull().default("false"),
  
  // Provider-specific metadata
  metadata: jsonb("metadata"),  // { favicon, citationType, sourceName }
  
  createdAt: createdAt,
  updatedAt: updatedAt,
});
```

#### 4.3 `crawlBrandMention` Table
Track brand & competitor mentions with context.

```typescript
// packages/db/src/schema/crawlBrandMention.ts

export const crawlBrandMentionTable = pgTable("crawl_brand_mention", {
  id: id,
  crawlId: text("crawl_id").notNull()
    .references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),
  competitorId: text("competitor_id")
    .references(() => competitorTable.id, { onDelete: "set null" }),
  
  // Brand info (denormalized for quick access)
  brandName: text("brand_name").notNull(),
  brandUrl: text("brand_url"),
  
  // Context
  context: text("context").notNull(),       // ±200 char snippet
  position: integer("position"),            // Character offset in content
  
  // Classification
  mentionType: text("mention_type").notNull(),  // "target" | "competitor" | "other"
  relativePosition: text("relative_position"),  // "first" | "early" | "middle" | "late"
  
  // Detection flags
  isRecommendation: text("is_recommendation").default("false"),
  objection: text("objection"),             // Negative phrase if detected
  
  // Provider-specific metadata
  metadata: jsonb("metadata"),              // { sentiment, llmConfidence, rankPosition }
  
  createdAt: createdAt,
  updatedAt: updatedAt,
});
```

### Tables to Extend (2 existing tables)

#### 4.4 `domainProject` — Add brand tracking fields

```typescript
// Add to existing domainProjectTable:

name: text("name"),                        // "ConvoForm" (display name)
aliases: jsonb("aliases").default("[]"),   // ["ConvoForm", "Convo Form", "ConvoForm.com"]
active: text("active").notNull().default("true"),
```

#### 4.5 `promptQueryCrawl` — Add run metadata

```typescript
// Add to existing promptQueryCrawlTable:

domainProjectId: text("domain_project_id").references(() => domainProjectTable.id),
promptSnapshot: text("prompt_snapshot"),      // Query text at time of run
answerFormat: text("answer_format"),          // "numbered_list" | "paragraph" | "comparison_table" | "conversational" | "unknown"
wordCount: integer("word_count"),
sourceCount: integer("source_count").default(0),
brandMentionCount: integer("brand_mention_count").default(0),
```

### Schema Relationships

```
domainProject (1) ──── (M) competitor
domainProject (1) ──── (M) promptQuery
domainProject (1) ──── (M) promptQueryCrawl

competitor (1) ──── (M) crawlBrandMention

promptQueryCrawl (1) ──── (M) crawlSource
promptQueryCrawl (1) ──── (M) crawlBrandMention
```

---

## 5. Visibility Score Formula (Phase 2)

Computed after each run. Four weighted components (store each separately for UI breakdown).

| Component | Max points | Calculation |
|---|---|---|
| Mention rate | 40 | % of last N runs where brand was mentioned × 40 |
| Average position | 25 | Position 1 = 25, pos 2 = 18, pos 3 = 12, pos 4 = 6, pos 5+ = 0 |
| Citation rate | 20 | % of last N runs where ≥1 own-domain URL was cited × 20 |
| Sentiment score | 15 | Positive = 15, neutral = 7, negative = 0 |

N (lookback window) defaults to 30 runs.

---

## 6. Brand Mention Detection Logic

Pure text processing — no LLM involved. Runs on raw answer text.

1. **Normalise**: Strip markdown, lowercase, collapse whitespace
2. **Build match set**: `domainProject.name` + all entries in `domainProject.aliases`
3. **Search**: Find every character offset of every match
4. **Extract snippet**: ±200 characters from original (un-normalised) text around each match
5. **Position rank**: Collect all brand + competitor first-occurrence offsets, sort ascending, assign ordinal ranks
6. **Relative position**: Rank 1 = `first`, ranks 2–3 = `early`, ranks 4–6 = `middle`, rank 7+ = `late`
7. **Detect recommendation**: Scan ±100 chars around mention for: "recommend", "suggest", "best option", "top choice", "go with", "I'd use", "ideal for"
8. **Detect objection**: Scan ±150 chars around mention for negative qualifier phrases; store first match verbatim

---

## 7. Sentiment Classification

Lightweight LLM call per snippet. Uses cheapest available model. Only fires when brand was mentioned.

**Input**: Snippet text (≤400 characters)
**Output**: `positive`, `neutral`, or `negative` + optionally short objection phrase if negative

Fire-and-forget async call. Run can be marked `completed` before sentiment resolves.

---

## 8. Citation Extraction (Provider-Specific)

Each provider surfaces source URLs differently. Browser-crawler handles provider-specific extraction; result passed up is always a flat ordered list of URLs.

- **Perplexity**: Citations are numbered source links below the answer. Extract from DOM before/after clipboard copy.
- **ChatGPT (web search)**: Sources appear in dedicated sources panel or inline footnotes.
- **Gemini**: Source cards appear below the answer.
- **Grok / Claude**: Sources may or may not be present. If no source section found, citation list is empty (valid).

After extraction, for each URL:
- Parse hostname as domain
- Compare against `domainProject.domain` to set `isOwnDomain`
- Compare against each entry in `competitors` to set `isCompetitorDomain`
- Store ordinal position in source list

---

## 9. User-Facing Pages (Phase 1)

### 9.1 Prompt Analytics View (per prompt)

**Top metric row (four cards):**
- Composite Visibility Score (Phase 2)
- Mention Rate (% of runs with a mention)
- Average Position (number)
- Citation Rate (% of runs with ≥1 own-domain citation)

**By provider section:**
- Row per active provider showing individual visibility score
- Bar scaled to 100 for visual comparison

**Mention snippets section:**
- Most recent snippet per provider: provider name, position rank, sentiment badge, recommendation flag, verbatim snippet with brand name highlighted
- Paginated for historical snippets

### 9.2 Citation Intelligence View (per prompt)

**Most-cited domains table:**
- Domain, citation count, first seen, last seen
- Brand's own domain rows highlighted distinctly
- Sorted by frequency descending

**Citation gap table:**
- Domains cited frequently but zero times for brand's own URLs
- Each row: domain, how often cited for competitors, how often cited for brand (zero)

### 9.3 Run Log

Filterable table of every individual run.

Filters: prompt, provider, date range, mention status (mentioned / not mentioned).

Columns: timestamp, provider, prompt text (truncated), mentioned, position rank, sentiment, citation count, duration, status.

Expanding a row shows: full raw answer text, all detected brand mentions with snippets, all extracted citations.

---

## 10. What the User Configures

| Setting | Description |
|---|---|
| Brand name & aliases | Display name + name variations for mention detection |
| Prompts | Query text, active/paused toggle |
| Providers | Which AI engines to include (toggleable) |
| Competitors | Competitor domains for share of voice & citation gap calculations |

---

## 11. Out of Scope for Phase 1

- Scheduled/batch crawling (manual single-prompt runs only)
- Visibility score computation (Phase 2)
- Drift alerts (Phase 2)
- LLM-generated insights (Phase 2)
- Google AI Overviews monitoring
- Content optimisation suggestions
- White-label report PDF export
- Public REST API access

---

## 12. Implementation Order

### Step 1: Database Schema
1. Update `packages/db/src/schema/domainProject.ts` (add `name`, `aliases`, `active`)
2. Create `packages/db/src/schema/competitor.ts`
3. Create `packages/db/src/schema/crawlSource.ts`
4. Create `packages/db/src/schema/crawlBrandMention.ts`
5. Update `packages/db/src/schema/promptQueryCrawl.ts` (add new columns)
6. Update `packages/db/src/schema/index.ts` (export all new tables)
7. Run `bun run db:generate` to create migration
8. Run `bun run db:push` (dev) or `bun run db:migrate` (prod)

### Step 2: Browser Crawler Enhancement
1. Extend `packages/browser-crawler/src/providers/perplexity.ts` to extract:
   - Inline citations with source names and URLs
   - Citations panel data (title, description, domain, favicon)
   - Brand mentions with context
2. Update `CrawlResult` type to include structured data
3. Test with ConvoForm and other brands

### Step 3: Trigger Task
1. Create Trigger.dev task to orchestrate crawl execution
2. Implement brand mention detection logic (text processing)
3. Implement sentiment classification (LLM call)
4. Implement citation domain resolution
5. Save all data atomically to DB

### Step 4: tRPC API
1. Create routers for:
   - Competitor CRUD
   - Crawl execution (manual trigger)
   - Run log queries
   - Analytics data (mentions, citations, metrics)
2. Implement proper input validation with Zod schemas

### Step 5: UI Components
1. Prompt Analytics view
2. Citation Intelligence view
3. Run Log table
4. Competitor management form
5. Brand alias configuration

---

## 13. Research Output

All Perplexity research data is stored in:
`packages/browser-crawler/scripts/.research-output/`

Key files:
- `full-page.html` — Full HTML dump of Perplexity result page
- `structure-analysis.json` — Page structure breakdown
- `detailed-citations.json` — Extracted citations and brand mentions
- `perplexity-patterns.json` — UI patterns and elements
- `clipboard-content.txt` — Current plain text extraction
- `RESEARCH_SUMMARY.md` — Complete analysis summary

---

## 14. Provider-Agnostic Design Principles

1. **Minimal & Universal**: Only store data that ANY provider can provide (sources, brands, URLs)
2. **Extensible via JSONB**: Provider-specific details go into `metadata` JSONB column
3. **No Perplexity-specific columns**: Avoid bloating schema with data only Perplexity provides
4. **Future providers**: ChatGPT, Gemini, Grok, Claude can store their own metadata without schema changes

### Metadata Examples

**crawlSource.metadata**:
```json
{
  "favicon": "https://www.google.com/s2/favicons?sz=128&domain=github.com",
  "citationType": "inline",
  "sourceName": "github"
}
```

**crawlBrandMention.metadata**:
```json
{
  "sentiment": "positive",
  "rankPosition": 1,
  "llmConfidence": 0.92
}
```

---

## 15. Data Flow

```
User triggers crawl (manual)
    ↓
tRPC router → Trigger.dev task
    ↓
Browser Crawler (PerplexityProvider)
    ↓
CrawlResult {
  content: "plain text",
  structured: {
    citations: [...],
    brands: [...],
    metadata: {...}
  }
}
    ↓
Trigger task processes:
  1. Brand mention detection (text processing)
  2. Sentiment classification (LLM)
  3. Citation domain resolution
    ↓
Save atomically to DB:
  - promptQueryCrawl (run metadata + content)
  - crawlSource (citations)
  - crawlBrandMention (brand mentions)
    ↓
Return results to UI
```
