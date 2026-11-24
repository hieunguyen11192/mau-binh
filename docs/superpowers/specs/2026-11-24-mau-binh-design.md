# Mậu Binh — Design Spec

**Date:** 2026-11-24  
**Location:** `/Volumes/WD 1TB/Projects/24. Dự án game bài Mậu Binh`  
**Status:** Draft for user review  

## 1. Goal

Build a playable Vietnamese **Mậu Binh** (Chinese Poker / 十三水-style) web game:

- **4 players:** 1 human vs 3 AI bots  
- **Host:** Vercel (static)  
- **UI language:** Vietnamese only  
- **Stack:** Vite + TypeScript (no React/Next for MVP)  
- **Write new codebase** (do not fork); use [macroxue/13-warriors](https://github.com/macroxue/13-warriors) as rules/AI reference only  

### Success (MVP Done)

1. Play a full hand in the browser: deal → arrange → compare → scores  
2. Chi/special scoring aligned with 13-warriors semantics  
3. **So Át** bonus applied correctly each round  
4. Four difficulty levels (Jack/Queen/King/Ace behavior) work  
5. Deployable to Vercel from `vite build` output  

### Out of scope (MVP)

- Online multiplayer / rooms / accounts  
- Real-money or chip betting economy  
- React rewrite, avatar shop, heavy audio  
- Pro-level AI beyond 13-warriors handicap model  

## 2. Architecture

```
mau-binh/
  src/
    core/           # pure rules (no DOM)
      cards.ts      # deck, rank, suit
      hand.ts       # wave/chi evaluation, specials, foul
      scoring.ts    # pairwise chi units + specials
      so-at.ts      # So Át / So Hai → 30/20/10/0
      deal.ts       # shuffle, 4×13
    ai/             # HandOptimizer-style arrangement + handicap
    ui/             # DOM table, arrange, scoreboard
    main.ts         # round lifecycle
  index.html
  styles/
  tests/            # unit tests for core
  vercel.json
  package.json
```

**Boundaries**

- `core` has zero DOM/browser APIs; fully unit-testable  
- `ai` depends only on `core`; returns `{ front[3], middle[5], back[5] }`  
- `ui` renders state and sends user intents to `main`  
- Vite builds static assets to `dist/` for Vercel  

## 3. Round flow

1. **Select difficulty** (Jô / Đầm / Già / Át) then **Deal** — shuffle 52, each player 13 cards. Human sees own hand; bots face-down until reveal.  
2. **Arrange** — human assigns cards to Front (3) / Middle (5) / Back (5). Optional **Xếp gợi ý** when level allows auto aid.  
3. **Bots arrange** in parallel with same engine + selected handicap. Bots do not see other hands.  
4. **Lock** — human submits; validate order Back ≥ Middle ≥ Front. Foul handled per reference semantics.  
5. **Compare chi** — score units + specials across four players → `chiScore` per seat.  
6. **So Át** — rank seats 1–4 → add 30/20/10/0 → `roundScore = chiScore + soAtBonus`.  
7. **Accumulate** session totals; **New round** keeps totals.  

## 4. Scoring

### 4.1 Base (13-warriors-style)

- **4-player generalization:** for each chi, compare **every pair of seats**; winner of the pair gains the unit points for that pattern, loser loses the same amount (zero-sum per pair). Sum across pairs and chis → `chiScore` per seat.  
- Special patterns / scoop (win all 3 chis vs an opponent) / foul: port semantics from 13-warriors (`WaveEvaluator`, `SpecialPattern`, scoring in `game.js`), applied per opposing seat. Exact point tables live in code comments and tests.  
- **Fold:** seat that folds scores `0` chi for the round, does not arrange, and still participates in **So Át** (Aces/Hai are from the dealt 13 cards). Opponents still compare chi among non-folded seats only.  
- Result per seat for the round: `chiScore` (0 if folded).  

### 4.2 So Át (additive each round)

| Rank | Points |
|------|--------|
| Nhất | 30 |
| Nhì | 20 |
| Ba | 10 |
| Bét | 0 |

**Ranking procedure**

1. Count **Aces** in each player's 13 cards.  
2. Higher Ace count ranks higher.  
3. Tie on Ace count **and count > 0:** compare only each player's **strongest Ace** by suit:  
   **Hearts ♥ > Diamonds ♦ > Clubs ♣ > Spades ♠**  
4. Among players still tied for remaining places who **all have 0 Aces:** apply **So Hai** with the same mechanism (count of rank-2 cards; tie → strongest Two by the same suit order). So Hai applies whenever a remaining group all have 0 Aces—not only the 2+2 Aces case.  
5. If still tied after So Hai (e.g. no Twos or identical strongest Two): **split evenly** the points of the occupied ranks among the tied seats.  

`roundScore = chiScore + soAtBonus`.

## 5. AI & difficulty

Port the spirit of 13-warriors `level_def` + `HandOptimizer(hand, handicap)`:

| UI name | Reference | `ai_handicap` | AI claim special | Auto arrange aid | Claim aid | Fold | Peek bots |
|---------|-----------|---------------|------------------|------------------|-----------|------|-----------|
| Jô | Jack | 6 | no | yes | yes | no | yes |
| Đầm | Queen | 4 | no | yes | yes | no | yes |
| Già | King | 2 | yes | yes | yes | yes | yes |
| Át | Ace | 0 | yes | no | no | yes | no |

- One level selected for the table; **all three bots** use that handicap and claim/fold rules.  
- Higher handicap → intentionally weaker arrangement than optimal.  
- Small random choice among near-equal arrangements so rounds vary.  
- Sync arrange; target well under interactive latency (tens of ms per bot on typical hardware).  

## 6. UI / UX

- Desktop-first single table view; readable on mobile.  
- Seats: three bots around the table; human at bottom with 13-card tray + three chi slots.  
- Sidebar/panel: cumulative scores + per-round breakdown (chi / So Át / total).  
- Pre-round: difficulty select + Deal.  
- Interactions: click-to-place (drag optional if cheap); buttons Xếp gợi ý / Xong / Úp bài / Claim special shown per level flags.  
- Visual: dark felt table, high-contrast cards, clear Vietnamese labels; light motion on reveal/score.  
- MVP: no chat, shops, or complex audio (optional win/lose SFX later).  

## 7. Testing

Unit-test `core` (and AI validity) with Vitest (or equivalent):

- Deal: 52 unique cards, 4×13  
- Foul / chi order validation  
- Chi + special scoring fixtures aligned with reference cases  
- So Át / So Hai / even split on residual ties  
- Each difficulty produces legal arrangements (no foul from bot under normal optimizer path)  

## 8. Deploy

- `vite build` → `dist/`  
- `vercel.json` for static hosting; SPA fallback to `index.html` if needed  
- No game server required for MVP  

## 9. Implementation notes

- Prefer small pure functions in `core` with explicit types for `Card`, `Hand`, `SeatScore`.  
- Do not copy 13-warriors assets/UI wholesale; reimplement logic with clear Vietnamese UX.  
- Respect project file-output rules: all project files stay under this project directory.  

## 10. Open decisions (resolved)

| Topic | Decision |
|-------|----------|
| Platform | Web + Vercel |
| Codebase | New (not fork) |
| Framework | Vite + TypeScript |
| So Át vs chi score | Additive |
| So Át key | Ace count → strongest Ace suit |
| Suit order | ♥ > ♦ > ♣ > ♠ |
| Multi-Ace tie | Strongest Ace only |
| Zero-Ace remainder | So Hai (count → strongest suit) |
| Residual tie | Split rank points evenly |
| UI language | Vietnamese |
| Difficulty | Four levels like 13-warriors |
| Bot names for levels | Jô / Đầm / Già / Át |
