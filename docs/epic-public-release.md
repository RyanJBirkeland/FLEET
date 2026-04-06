# Epic: Public Release Readiness (PR)

**Date:** 2026-04-06
**Owner:** Ryan
**Goal:** Prepare BDE for public GitHub visibility — no secrets, no private references, no embarrassing defaults — so the repo can be flipped from private to public with read-only access for the world.

---

## Context

BDE is currently a private repo (`RyanJBirkeland/BDE`) with ~2700 commits, 5 recently-merged Phase 1-5 PRs addressing a multi-persona product audit, and ~122K LOC. The decision is to make it **public but without write access** — i.e., a normal public GitHub repo where anyone can clone/fork/read but only maintainers can merge.

This is a one-way action in practice. Once content is public and indexed, it's forever. This epic tracks everything that must be true before flipping the visibility.

### What "public" means
- ✅ Anyone can view, clone, fork the repo
- ✅ Anyone can open issues and PRs (if enabled)
- ✅ Git history (including removed-but-committed secrets) is visible
- ❌ Only collaborators can push or merge
- ❌ Branch protection still enforced against `main`

### What we're NOT doing
- Not removing private dependencies or rearchitecting
- Not implementing licensing validation or feature-gating
- Not accepting outside contributions yet (that's a separate decision)
- Not signing the macOS build (out of scope — separate epic if desired)

---

## Risk Matrix

| Gap | Risk | Impact if Missed |
|---|---|---|
| Secrets in git history | **Critical** | Leaked API keys, OAuth tokens, personal credentials |
| Missing LICENSE file | **Critical** | Unclear legal terms, can't be forked without ambiguity |
| Hardcoded personal paths | High | Documents Ryan's file layout, reveals other private projects |
| CLAUDE.md references to private projects | High | Exposes existence of unannounced projects (BDE, life-os, claude-chat-service) |
| Audit doc grading tone | Medium | Public self-criticism may affect perception; may include private context |
| Missing README for public audience | Medium | First impression is a dev-internal doc |
| No CONTRIBUTING.md | Medium | Unclear whether PRs are welcome |
| No SECURITY.md | Medium | No channel for responsible disclosure |
| Vendored/bundled secrets | High | `.bde/oauth-token`, `.env*` files accidentally committed |
| PR/issue templates missing | Low | Lower-quality external reports |
| Code of Conduct missing | Low | No stated community standards |
| Unsigned DMG in releases | Low | Users need `xattr -d com.apple.quarantine` or right-click → Open |
| `@../../ARCHITECTURE.md` import in CLAUDE.md | Medium | Cross-repo reference to `~/projects/ARCHITECTURE.md` which isn't public |

---

## Stories

### P0 — Must Fix Before Flipping Visibility

#### PR-S1: Secrets audit on full git history
**Type:** Security audit
**Estimate:** M
**Acceptance criteria:**
- Run `gitleaks detect --source . --log-opts "--all"` (or `trufflehog git file://.` if gitleaks unavailable)
- Manually grep git log for known sensitive patterns: `sk-`, `ghp_`, `gho_`, `github_pat_`, `AKIA`, `Bearer `, `-----BEGIN`, `.pem`, `.key`, `oauth-token`, `ANTHROPIC_API_KEY=`, `SUPABASE_SERVICE_ROLE_KEY`
- Check for any committed `.env`, `.env.local`, `credentials.json`, `oauth-token` files (even if since-deleted)
- Report findings with commit hashes
- **If secrets found:** decide between (a) `git filter-repo` rewrite (destructive, breaks forks-not-yet-forked so OK here) or (b) rotate the secrets and document
- **Deliverable:** `docs/security/secrets-audit-2026-04-06.md` with findings and remediation

#### PR-S2: Add LICENSE file
**Type:** Legal
**Estimate:** S
**Acceptance criteria:**
- Add a `LICENSE` file at repo root
- Recommended: **MIT License** (permissive, matches most OSS dev tools) — but final call is the owner's
- Alternatives to consider:
  - **Apache 2.0** — patent protection clause, more formal
  - **AGPL-3.0** — copyleft, forces downstream to open-source modifications (pick if you're worried about commercial forks hiding changes)
  - **Source-Available (BSL 1.1)** — can be used/forked but not run as a hosted service (overkill for desktop apps)
- Update `package.json` `"license"` field to match
- **Deliverable:** LICENSE file + updated package.json

#### PR-S3: `.gitignore` hardening
**Type:** Security hygiene
**Estimate:** S
**Acceptance criteria:**
- Audit current `.gitignore` for completeness
- Confirm excluded: `.bde/`, `*.db`, `*.db-wal`, `*.db-shm`, `*.db.backup`, `.env*`, `oauth-token`, `release/`, `dist/`, `out/`, `node_modules/`, `.DS_Store`, `*.log`, `~/worktrees/**`, `.env.local`, `.vercel`, `.turbo`, `coverage/`, `playwright-report/`, `test-results/`
- Add `CLAUDE.local.md` (user-specific Claude config that shouldn't be public)
- Verify nothing currently tracked matches excluded patterns via `git ls-files | git check-ignore --stdin --non-matching`
- **Deliverable:** updated `.gitignore` + verification output

#### PR-S4: Sanitize CLAUDE.md for public audience
**Type:** Content review
**Estimate:** M
**Acceptance criteria:**
- Remove or relocate `@../../ARCHITECTURE.md` import (cross-repo reference to `~/projects/ARCHITECTURE.md`)
- Review all mentions of private projects (life-os, bde-site, claude-chat-service, claude-task-runner, repomap) — decide whether to keep references or remove
- Remove references to personal infrastructure: `rbtdash.com`, VPS paths, Supabase `iorjhnpjpqimklrpwimf`
- Keep BDE-specific architectural guidance (that's the whole point)
- Consider splitting into `CLAUDE.md` (public-safe dev guide) + `CLAUDE.local.md` (personal, gitignored)
- **Deliverable:** sanitized `CLAUDE.md`, optionally add `CLAUDE.local.md.example`

#### PR-S5: Public-facing README rewrite
**Type:** Content
**Estimate:** M
**Acceptance criteria:**
- Current README is dev-internal — rewrite for a first-time visitor
- Include:
  - What BDE is (one-sentence tagline + 2-paragraph description)
  - Screenshot / demo GIF showing the review station (the killer feature)
  - Prerequisites (Claude Code CLI, Anthropic subscription, macOS, git, gh)
  - Quickstart (clone → install → configure → first task)
  - Feature highlights (link to docs/BDE_FEATURES.md for detail)
  - Tech stack
  - Status: "active development, unstable, expect breaking changes"
  - License badge
  - Link to CONTRIBUTING.md (even if it says "not accepting PRs yet")
  - Link to the audit doc if you want transparency, or omit if you don't
- Keep the old dev-internal content as `docs/DEVELOPMENT.md` or similar
- **Deliverable:** rewritten `README.md`

#### PR-S6: Verify no credentials/state files in history
**Type:** Security audit
**Estimate:** S
**Acceptance criteria:**
- Run `git log --all --full-history --source -- '.bde/*' 'oauth-token' '*.env' '*.env.local' 'credentials.json' 'bde.db'` and verify empty
- Run `git rev-list --all | xargs -n1 -I{} git ls-tree -r {} | sort -u | grep -iE '(secret|token|credential|oauth|\.env)' | head`
- If any findings, escalate to PR-S1 remediation
- **Deliverable:** verification output attached to PR-S1 report

---

### P1 — Should Fix Before Flipping, OK to Ship Together

#### PR-S7: Add SECURITY.md
**Type:** Content
**Estimate:** S
**Acceptance criteria:**
- File at repo root (GitHub auto-detects)
- State responsible disclosure channel (email or GitHub private vulnerability reporting)
- State which versions receive security fixes (just `main` is fine for now)
- State scope: what is and isn't considered a security issue
- **Deliverable:** `SECURITY.md`

#### PR-S8: Add CONTRIBUTING.md
**Type:** Content
**Estimate:** S
**Acceptance criteria:**
- Clearly state contribution policy — "not accepting outside PRs yet" is a valid policy
- Document dev setup (link to the existing CLAUDE.md build instructions)
- Document issue-reporting format
- State code of conduct reference
- **Deliverable:** `CONTRIBUTING.md`

#### PR-S9: Add CODE_OF_CONDUCT.md
**Type:** Content
**Estimate:** S
**Acceptance criteria:**
- Use Contributor Covenant 2.1 boilerplate
- Update contact email
- **Deliverable:** `CODE_OF_CONDUCT.md`

#### PR-S10: GitHub repo configuration
**Type:** Config
**Estimate:** S
**Acceptance criteria:**
- Verify branch protection on `main`:
  - Require PR before merging
  - Require status checks to pass (CI)
  - Require linear history OR allow merge commits (owner's call)
  - Require signed commits (optional)
  - Block force pushes
  - Block deletions
- Set repo description + topics (tags for discoverability)
- Decide on Issues/Discussions — enable or disable deliberately
- Decide on Projects/Wiki — probably disable
- Set default branch to `main` (already done)
- Enable vulnerability alerts / Dependabot (optional but recommended)
- **Deliverable:** screenshot of settings, not a file change

#### PR-S11: Decide on audit doc visibility
**Type:** Editorial
**Estimate:** S
**Acceptance criteria:**
- Review `docs/audits/2026-04-06-multi-persona-product-audit.md` in public-reader mindset
- The audit has honest grades (B+/B-) and specific criticism. Owner decides:
  - **Option A:** Keep as-is — transparency is a feature, shows rigor
  - **Option B:** Move to `docs/private-audits/` and gitignore
  - **Option C:** Rewrite as a "roadmap derived from internal audit" doc removing the grading and persona framing
- Also review the 4 existing `docs/epic-*.md` files — they contain honest gap assessments that are arguably good marketing for "this team takes quality seriously"
- **Deliverable:** decision + any content moves

#### PR-S12: Review all `docs/*.md` for private references
**Type:** Content review
**Estimate:** M
**Acceptance criteria:**
- Grep all `docs/*.md` for: `ryan`, `birkeland`, `rbtdash`, `iorjhnpjpqimklrpwimf`, `/Users/`, `~/projects/`, `VPS`, `life-os`, `bde-site`, specific email addresses
- Decide which references are OK (e.g., attribution) vs. must-remove (e.g., paths, infrastructure)
- Pay particular attention to `docs/audit-*.md`, `docs/eval-*.md`, and `docs/architecture.md`
- **Deliverable:** updated docs + audit report

---

### P2 — Nice to Have

#### PR-S13: Issue and PR templates
**Type:** Content
**Estimate:** S
**Acceptance criteria:**
- `.github/ISSUE_TEMPLATE/bug_report.md` (reproducer, env, expected/actual)
- `.github/ISSUE_TEMPLATE/feature_request.md` (user story, motivation)
- `.github/pull_request_template.md` (summary, test plan, screenshots) — probably copy the existing PR body format the team uses
- **Deliverable:** `.github/` templates

#### PR-S14: Repo-level README badges
**Type:** Polish
**Estimate:** S
**Acceptance criteria:**
- CI status badge (GitHub Actions)
- License badge
- Version badge (if using semver releases)
- Electron/Node version requirements
- **Deliverable:** badges in README header

#### PR-S15: Demo GIF or screenshot
**Type:** Marketing
**Estimate:** M
**Acceptance criteria:**
- Record a 10-30s GIF showing the task → agent → review → merge loop
- Or a static screenshot of the dashboard with real-looking data
- Commit to `docs/assets/` or similar
- Embed in README
- **Deliverable:** visual asset + README reference

#### PR-S16: Releases page — attach signed/notarized DMG (optional, defer)
**Type:** Distribution
**Estimate:** L
**Acceptance criteria:** See `docs/epic-*.md` for signing epic if/when created.
- This is out of scope for public visibility but worth tracking as follow-up.
- Without signing, users need `xattr -d com.apple.quarantine` or right-click → Open the first time.
- **Status:** DEFER — not a blocker.

---

## Execution Order

The stories have natural dependencies but most can run in parallel:

```
Phase 1 (P0, sequential — secrets first):
  PR-S1 (secrets audit)  →  PR-S6 (state file audit)  →  remediation if needed

Phase 2 (P0, parallel):
  PR-S2 (LICENSE)
  PR-S3 (.gitignore)
  PR-S4 (sanitize CLAUDE.md)
  PR-S5 (public README)

Phase 3 (P1, parallel):
  PR-S7 (SECURITY.md)
  PR-S8 (CONTRIBUTING.md)
  PR-S9 (CODE_OF_CONDUCT.md)
  PR-S10 (GitHub config)
  PR-S11 (audit doc decision)
  PR-S12 (docs/*.md review)

Phase 4 (P2, post-launch OK):
  PR-S13 (templates)
  PR-S14 (badges)
  PR-S15 (demo GIF)

Phase 5 (gate):
  Final review → flip visibility → announce (or don't)
```

---

## Definition of Done

Visibility flip happens ONLY when:
- [ ] PR-S1 secrets audit clean (or remediated)
- [ ] PR-S2 LICENSE in place
- [ ] PR-S3 `.gitignore` hardened and verified
- [ ] PR-S4 CLAUDE.md sanitized
- [ ] PR-S5 public README shipped
- [ ] PR-S6 no state files in history
- [ ] PR-S10 branch protection verified
- [ ] PR-S11 audit doc decision made
- [ ] PR-S12 docs reviewed
- [ ] Manual dry-run: clone the repo to a throwaway directory as a fresh user and confirm it's understandable and runnable
- [ ] Owner final sign-off

Then:
```bash
gh repo edit RyanJBirkeland/BDE --visibility public --accept-visibility-change-consequences
```

---

## Success Metrics

- Zero secrets in git history (measured by gitleaks/trufflehog clean run)
- Zero "what is this?" confusion from a fresh visitor reading the README (measured by asking 1-2 people to read it cold)
- CI green on `main` at flip time
- Branch protection rules active and tested
- No public reference to unannounced private infrastructure

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Secrets discovered in history | Rotate and rewrite history with `git filter-repo` — do BEFORE first push to public |
| README review takes longer than expected | Ship README in stages — minimum viable first, polish later |
| Audit doc reveals too much internal context | Move to private location rather than publishing |
| People open PRs we don't want to review | CONTRIBUTING.md clearly states policy + disable PRs temporarily via branch protection if needed |
| Fork divergence if someone forks and modifies | Normal OSS risk — MIT license disclaims liability |
| Broken setup instructions | Manual dry-run on a clean machine before flipping |

---

## Out of Scope (separate epics if needed)

- Code signing / notarization for macOS
- Accepting external contributions (governance, review workflow, maintainer list)
- Website / landing page
- Distribution via Homebrew / package managers
- Multi-platform builds (currently macOS arm64 only)
- Versioned releases / CHANGELOG
- i18n
- Telemetry opt-in/out

---

## Related Docs

- `docs/audits/2026-04-06-multi-persona-product-audit.md` — the source of the Phase 1-5 PRs that just landed
- `docs/epic-architecture-dx.md`, `docs/epic-design-polish.md`, `docs/epic-feature-completeness.md`, `docs/epic-testing-qa.md` — existing internal epics
- `docs/BDE_FEATURES.md` — feature reference
- `docs/architecture.md` — system architecture
- `CLAUDE.md` — current dev-internal guide (to be sanitized in PR-S4)
