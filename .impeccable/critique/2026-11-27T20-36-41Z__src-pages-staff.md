---
target: staff pages
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\Koushik Mallik\\Desktop\\Projects\\techomato-education\\src\\pages\\staff"
timestamp: 2026-11-27T20-36-41Z
slug: src-pages-staff
---
# Critique: staff surfaces (src/pages/staff)
Method: dual-agent. Score 21/40 (Acceptable). Assessed before the animate/colorize/typeset/layout/delight/overdrive pass.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | no result count in bank (fixed later) |
| 2 | Match real world | 3 | slogan hero titles |
| 3 | User control | 2 | native confirm/prompt, unconfirmed Remove, filters not in URL |
| 4 | Consistency | 1 | four different "average" formulas; differing pass thresholds |
| 5 | Error prevention | 2 | type switch wipes test cases; no unsaved guard |
| 6 | Recognition | 2 | Q1/Q2 chart labels; picker titles only (fixed later) |
| 7 | Flexibility | 1 | no bulk, shortcuts, export |
| 8 | Aesthetic | 2 | hero pushes work below fold (compact header added later) |
| 9 | Error recovery | 2 | toast-only errors |
| 10 | Help | 3 | strong inline hints |

## Priority issues
- [P0] Same metric, different numbers: TrainerResults/Trainer pool passed/total, TestResults/CourseDetail mean per student/cell. One average() in score.js. (harden) OPEN
- [P0] Test picker rendered entire bank. FIXED (search, picked first, cap 30).
- [P1] Bank rendered 1007 cards, no count. FIXED (incremental + content-visibility + count).
- [P1] PageHero on every staff page. MOSTLY FIXED (compact variant); still dark in light theme. (quieter)
- [P2] Native confirm/prompt, unconfirmed Remove (CourseDetail.jsx:390), silent test-case wipe on type change. (harden) OPEN

## Detector
CLI 0 findings. Browser: shared-component findings only: Avatar 10px initials (ui.jsx:59), HeroPill pulsing dot, skipped heading h1->h3 in Step (trainerShared.jsx:60), stragglers; false positives: nested-cards (hero stat tiles), text-occlusion (Ring svg).

## Personas
Alex: no bulk/export, filters not in URL, 440px answers modal. Sam: Modal focus trap leaks, no aria-labelledby, ~1000 h2s in bank, toast-only errors.
