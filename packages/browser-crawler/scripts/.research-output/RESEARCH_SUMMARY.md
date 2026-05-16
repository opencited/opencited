# Perplexity Crawl Enhancement Research

## Executive Summary

Perplexity provides **much more structured data** than just plain text. The result page contains:
1. **Inline citations** with source names and URLs
2. **A citations panel** with detailed source cards (10 sources for ConvoForm query)
3. **Structured content** (tables, headings, lists)
4. **Brand mentions** with context
5. **Related questions** for follow-up

## What Perplexity Returns (ConvoForm Example)

### 1. Clipboard Content (Current Method)
**Format**: Markdown-style text with inline citations
```
ConvoForm.com appears to be a lightweight AI conversational form builder...
[source_name](url)

## What it does well
ConvoForm's positioning is clear... [devfolio](url)

## Competitors to compare
| Category | Competitors | Why they matter |
| Conversational forms | Voiceform, NoForm AI... | [g2](url) |
```

**What we currently save**: Just this plain text in `prompt_query_crawl.content`

### 2. Inline Citations (In the answer text)
**Structure found**:
```html
<span class="citation inline">
  <span>github+1</span>
</span>
```

**Data extracted**:
- Source name: "github", "g2", "capterra", "devfolio", "estha"
- Position in text (1-12)
- Context (surrounding paragraph)
- URL (from parent link or citations panel)

**Count**: 12 inline citations for ConvoForm query

### 3. Citations Panel (Sidebar)
**Trigger**: Button with text "10 sources"

**Structure per source card**:
```json
{
  "domain": "github.com",
  "title": "growupanand/ConvoForm: Turn Forms into Conversations with AI",
  "description": "Create interactive conversational forms...",
  "url": "https://github.com/growupanand/ConvoForm",
  "favicon": "https://www.google.com/s2/favicons?sz=128&domain=github.com"
}
```

**Sources found for ConvoForm**:
1. github.com - ConvoForm GitHub repo
2. devfolio.co - ConvoForm project listing
3. g2.com - Voiceform competitors
4. capterra.in - GoFormz alternatives
5. estha.ai - AI form builders comparison
6. zite.com - AI form builders review
7. involve.me (mentioned)
8. voiceform (mentioned)
9. noform-ai (mentioned)
10. jotform (mentioned)

### 4. Brand Mentions
**Brands mentioned in ConvoForm result**:
- ConvoForm (target brand) - 15+ mentions
- Voiceform - competitor
- NoForm AI - competitor
- involve.me - competitor
- Orbit Forms - competitor
- Jotform - competitor
- Google Forms - competitor
- Formstack - competitor
- SurveyMonkey - competitor
- Qualtrics - competitor

**Context per mention**:
- Full sentence/paragraph where brand appears
- Sentiment (positive/negative/neutral) - needs NLP
- Category (self/competitor/partner) - needs classification

### 5. Structured Content
**Found in ConvoForm result**:
- **Headings**: H1 (query), H2 (5 sections)
  - "What it does well"
  - "Likely limitations"
  - "Competitors to compare"
  - "Best alternatives by use case"
  - "Practical verdict"
- **Tables**: 2 comparison tables
  - Category | Competitors | Why they matter
- **Lists**: Bullet points in sections

### 6. Related Questions
**Found at bottom of result**:
- "How does ConvoForm compare with NoForm AI?"
- "What are the pricing details for ConvoForm?"
- "Which features make conversational forms improve conversions?"
- "How does ConvoForm stack up against Jotform and Formstack?"
- "What integrations does ConvoForm support?"

## Recommended Database Schema

### Table 1: `crawl_source_citation`
Stores each source cited in the response.

```sql
CREATE TABLE crawl_source_citation (
  id TEXT PRIMARY KEY,
  crawl_id TEXT NOT NULL REFERENCES prompt_query_crawl(id) ON DELETE CASCADE,
  
  -- Source info
  source_name TEXT NOT NULL,           -- "github", "g2", "capterra"
  domain TEXT NOT NULL,                -- "github.com"
  url TEXT NOT NULL,                   -- Full URL
  favicon_url TEXT,                    -- Favicon URL
  
  -- Content
  title TEXT,                          -- Source page title
  description TEXT,                    -- Source description/snippet
  
  -- Positioning
  citation_position INTEGER,           -- Order in response (1, 2, 3...)
  citation_type TEXT,                  -- "inline" | "panel"
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table 2: `crawl_brand_mention`
Stores each brand mentioned in the response.

```sql
CREATE TABLE crawl_brand_mention (
  id TEXT PRIMARY KEY,
  crawl_id TEXT NOT NULL REFERENCES prompt_query_crawl(id) ON DELETE CASCADE,
  
  -- Brand info
  brand_name TEXT NOT NULL,            -- "ConvoForm", "Jotform"
  brand_url TEXT,                      -- Brand website if found
  brand_category TEXT,                 -- "target" | "competitor" | "partner" | "other"
  
  -- Context
  context TEXT NOT NULL,               -- Full sentence/paragraph
  sentiment TEXT,                      -- "positive" | "negative" | "neutral" | "unknown"
  mention_position INTEGER,            -- Character position in content
  
  -- Ranking (if applicable)
  rank_position INTEGER,               -- If brand is ranked (1, 2, 3...)
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table 3: `crawl_related_question`
Stores related questions from Perplexity.

```sql
CREATE TABLE crawl_related_question (
  id TEXT PRIMARY KEY,
  crawl_id TEXT NOT NULL REFERENCES prompt_query_crawl(id) ON DELETE CASCADE,
  
  question TEXT NOT NULL,              -- The related question
  position INTEGER,                    -- Order in list
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Extend `prompt_query_crawl` table
Add summary fields:

```sql
ALTER TABLE prompt_query_crawl ADD COLUMN source_count INTEGER;
ALTER TABLE prompt_query_crawl ADD COLUMN brand_count INTEGER;
ALTER TABLE prompt_query_crawl ADD COLUMN structured_data JSONB;
```

## Implementation Plan

### Phase 1: Enhanced Perplexity Provider
**File**: `packages/browser-crawler/src/providers/perplexity.ts`

1. Keep existing clipboard extraction
2. Add citation panel extraction:
   - Click "X sources" button
   - Extract source cards from panel
   - Parse title, description, URL, domain
3. Add inline citation extraction:
   - Find all `.citation.inline` elements
   - Extract source name, position, context
4. Add related questions extraction:
   - Find follow-up question buttons
5. Return structured data in `CrawlResult.structured` field

### Phase 2: Database Schema Migration
**File**: `packages/db/src/schema/`

1. Create `crawlSourceCitation.ts`
2. Create `crawlBrandMention.ts`
3. Create `crawlRelatedQuestion.ts`
4. Update `promptQueryCrawl.ts` with new fields
5. Create migration files

### Phase 3: Actions Package
**File**: `packages/actions/src/promptQueryCrawl/`

1. Update `saveCrawlResultAction` to:
   - Parse structured data from crawl result
   - Save source citations
   - Save brand mentions (with basic NLP for sentiment)
   - Save related questions
   - Update summary counts

### Phase 4: Brand Mention Detection
**Approach**: Simple keyword matching first, then NLP

1. **Simple**: Match against known brand names from `domainProject` table
2. **Advanced**: Use LLM to:
   - Detect brand names
   - Classify sentiment
   - Categorize (target/competitor/partner)

### Phase 5: UI/Analytics (Future)
Show structured results to users:
- Source citations list with links
- Brand mention cloud with sentiment
- Competitor comparison tables
- Related questions for deeper research

## Data Flow

```
Perplexity Page
    ↓
Browser Crawler (enhanced provider)
    ↓
CrawlResult {
  content: "plain text",
  structured: {
    citations: [...],
    brands: [...],
    questions: [...],
    tables: [...],
    headings: [...]
  }
}
    ↓
Trigger Task
    ↓
saveCrawlResultAction
    ↓
Database Tables:
  - prompt_query_crawl (content + counts)
  - crawl_source_citation (sources)
  - crawl_brand_mention (brands)
  - crawl_related_question (questions)
```

## Benefits

1. **Source Transparency**: Users can verify claims by clicking sources
2. **Brand Analytics**: Track brand mentions across queries over time
3. **Competitor Intelligence**: See which competitors are mentioned together
4. **Sentiment Tracking**: Monitor brand sentiment changes
5. **Related Questions**: Discover new query opportunities
6. **Structured Display**: Show rich results instead of plain text

## Next Steps

1. ✅ Research completed - understood Perplexity page structure
2. 🔄 Implement enhanced Perplexity provider
3. 🔄 Create database schema migrations
4. 🔄 Update actions to save structured data
5. 🔄 Test with ConvoForm and other brands
6. 🔄 Build UI to display structured results
