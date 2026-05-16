# ADR-0001: AI Visibility Page Redesign

**Status:** Accepted
**Date:** 2026-05-16
**Context:** AI Visibility UX redesign

## Problem

The AI Visibility page was organized around data types (Analytics, Citations, Run Logs) rather than user goals. The primary user — an SEO/brand marketer — wants to answer three questions in order:

1. Where do I show up in AI answers?
2. How do I compare to competitors?
3. What should I do about it?

The existing tab structure inverted this hierarchy, leading with operational meta-data (Analytics) and burying core visibility insight (Citations). Additionally, crawl history was duplicated across the Prompts page and AI Visibility page, and detail sheets repeated data already visible in list rows.

## Decision

### 1. Information Architecture Redistribution

| Page | Before | After |
|------|--------|-------|
| **Dashboard** | Generic stats (Sitemaps count, URLs count, Prompts count) | Visibility metrics: cited-in ratio, brand mention count, avg citation position, competitor outrank count, recent activity |
| **Prompts** | Prompt cards + History tab (crawl list) | Prompt management only (create, edit, delete, view). History tab removed. |
| **AI Visibility** | Three equal tabs: Analytics, Citations, Run Logs | Consolidated results page: visibility table, competitor intelligence, run logs (tertiary) |

### 2. AI Visibility Page Structure

**Primary view — Visibility Table** (replaces Analytics tab):
- One row per query (not per crawl)
- Columns: Query, Last Checked, Cited + Position, Brand Mentioned + Position, Competitors Cited, Trend (↑/↓/→)
- Clicking a row opens a detail sheet (latest crawl by default)
- Sheet header includes "View history" dropdown to switch between past runs
- Empty state with CTA to run first prompt when zero crawls exist

**Sheet Detail** (unified, replaces RunLogDetailSheet + CitationDetailSheet):
- **Answer tab** (default): Full AI response rendered as HTML with Copy button
- **Sources tab**: Citation list with position, own/competitor badges, URL; expandable for description and metadata
- **Mentions tab**: Brand mentions with type, relative position, full context, objections
- **Details tab**: Provider, load time, duration, answer format, word count, trigger run ID, prompt snapshot

**Secondary section — Competitor Intelligence**:
- Table: Competitor, Mentioned In, Avg Position, Appears Before You, Appears After You
- Clicking a competitor opens a sheet with: queries where mentioned, context snippets, recommendation vs mention, objections, head-to-head comparison

**Tertiary — Run Logs**:
- Collapsed operational view for debugging failed crawls

### 3. Sheet Redundancy Elimination

| Component | Action |
|-----------|--------|
| `RunLogDetailSheet` | Eliminated — merged into unified crawl detail sheet |
| `CitationDetailSheet` | Eliminated — sources shown in Sources tab with inline expand |
| `CrawlResultsSheet` (Prompts) | Simplified — only shows content since History tab is removed |

### 4. Design Principles

- No nested sheets — all detail in one sheet with internal tabs
- Row click opens sheet, not inline expansion
- Latest crawl opens by default; history accessible via dropdown
- Empty states guide action, not just show blank tables
- Competitive context always visible, never buried

## Consequences

### Positive
- User's primary question ("Where do I show up?") is answered immediately on page load
- Single source of truth for crawl results (AI Visibility page), eliminating duplication with Prompts
- Detail sheets show only unique data, making them meaningful drill-downs rather than redundant overlays
- Competitive intelligence is surfaced as a first-class concern

### Trade-offs
- Prompts page loses crawl history — users who want to see a specific prompt's results must navigate to AI Visibility and filter by query
- Visibility table aggregates across crawls, so per-crawl nuance requires opening the sheet
- Dashboard now depends on crawl data to compute metrics, adding a data dependency

### Reversibility
- Low cost to restore Prompts History tab if user feedback demands it
- Moderate cost to re-separate sheets if unified sheet proves too complex
- Low cost to adjust dashboard metrics
