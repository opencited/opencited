# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Solo developers and indie hackers who want to track, analyze, and improve their website's visibility in AI answer engines (ChatGPT, Perplexity, Claude, Gemini). They are technically capable, value transparency and control, and use this tool as a workspace for ongoing optimization—not a passive dashboard they check once a month.

**Secondary:** Marketing teams evaluating AEO/AIO performance for their own or client brands.

**Context:** Desk work during the day, possibly evening sessions; they need to move fast and find insights without friction.

## Product Purpose

OpenCited is an open-source Answer Engine Optimization (AEO) workspace: it analyzes, tracks, and improves how a brand appears in AI-generated answers. Success means a user can run crawls against answer engines, see a trustworthy visibility signal, and act on it repeatedly—without paying for closed-source tooling. The product exists to make AI-answer visibility measurable, inspectable, and improvable.

## Positioning

OpenCited's claim that a neighboring product could not truthfully copy: **open-source (MIT), self-hostable AEO analysis with no limits on workspaces, domains, or users**—against closed-source AEO/AIO tools charging $200–500/month. Mechanism-wise, the peer-relative AI Visibility Score is computed from a documented, versioned formula with inspectable sub-scores rather than a proprietary black-box number.

## Operating Context

- Users run prompt queries against answer engines; crawls execute in a background worker (BullMQ) via browser automation, so the web app is a workspace that dispatches and reviews jobs, not a real-time feed.
- Crawls may require proxies and per-provider rate limits; results arrive asynchronously and are reviewed later.
- Technical setup is part of the product: self-hosting (Postgres, Redis/Valkey, Clerk auth, LLM API key), Docker for the worker, Bun for development.
- Documentation and specs live in-repo: `README.md`, `CONTEXT.md` glossary, `docs/adr/`, `docs/agents/visibility-score.md`.
- Evaluation happens in the open: GitHub repo, MIT license, self-host guide.

## Capabilities and Constraints

**Confirmed functionality (repo evidence):**
- App surfaces: dashboard, AI visibility, prompts (with a system-curated prompt library/templating), competitors, sitemaps, run logs, settings (per-brand proxy config), onboarding.
- Multi-provider crawl architecture (Perplexity and ChatGPT live; Claude, Gemini, AI Overviews planned) behind a strategy/factory pattern.
- AI Visibility Score 0–100: `0.35·mention + 0.25·position + 0.20·citation + 0.10·sentiment + 0.10·coMention`, computed per-crawl, per-prompt, and peer-normalised per brand per engine.
- One organization = one `domainProject` = one brand (1:1:1); all feature data is scoped to it.
- Auth is Clerk (required in the open-source version).

**Constraints:**
- Bun + Next.js 16 + Drizzle/Neon Postgres + BullMQ/Valkey + Playwright worker; deployable to Vercel/Railway/self-hosted, worker needs Docker.
- Open-source edition ships without usage caps—do not design for metering/paywalls unless the user changes this.

**Explicitly undecided (do not invent):** monetization/hosted-tier plans; v1 score limitations (own-domain citations only, no temporal decay, peer-relative only) are documented gaps with a stated v1.1 direction, not confirmed roadmap dates.

## Brand Commitments

- **Name:** OpenCited.
- **License stance:** MIT, self-hostable, no workspace/domain/user limits in the open-source version.
- **Voice**: Precise, minimal, no fluff. Every element earns its place.
- **Personality**: Calm, focused, authoritative — a well-organized workspace that reduces cognitive load. Not flashy; confident through restraint. Technical but not intimidating.
- **3-word personality**: Calm · Technical · Refined

(Visual identity — palette, typography, components — is recorded in `DESIGN.md`, not here.)

## Evidence on Hand

- `README.md` — full product description, score formula, worked example, self-hosting guide.
- `CONTEXT.md` — canonical domain glossary (domainProject, crawl, visibilityScore, peer set, etc.).
- `docs/adr/0001-ai-visibility-redesign.md`, `0002-visibility-score.md`, `0003-multi-provider-architecture.md` — decision history.
- `docs/agents/visibility-score.md` — normative score specification.
- `DESIGN.md` — incumbent visual system ("Steel and Paper").
- **Absences future work must not fabricate:** no customer logos, testimonials, case studies, press, benchmarks, or pricing pages exist in the repo. No dedicated brand logo asset ships in `apps/web/public/` (only framework svgs).

## Product Principles

1. **Trust the number or don't ship it.** The score's formula, weights, and limits are documented and versioned; never present a black-box metric.
2. **Peer-relative honesty.** Visibility is measured against tracked competitors; a cold start is an explicit null state, never a fake zero.
3. **Open means uncapped.** The open-source edition never gates workspaces, domains, or users.
4. **Built for repeat work.** Design for the user who comes back weekly to iterate, not the one who visits once.
5. **Own the limitations.** Known v1 gaps are stated plainly; progress is disclosed, not smoothed over.

## Accessibility & Inclusion

**WCAG 2.1 AA** as baseline. The zinc monochrome palette naturally supports strong contrast ratios; verify all text meets 4.5:1 minimum.

- **Reduced motion**: Respect `prefers-reduced-motion`. Staggered entrances and state transitions should be disabled or simplified when the user requests reduced motion.
- **Keyboard navigation**: Full keyboard operability is non-negotiable for a keyboard-first tool. Focus rings must be visible and consistent.
- **Screen reader support**: Semantic HTML, proper ARIA labels on interactive elements, and meaningful alt text for any non-decorative imagery.
- **Color independence**: Status and state must not rely on color alone. Use icons, text labels, or patterns alongside color cues.
