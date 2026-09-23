RADIUM V51 — MATCH FLOW ORDER ENGINE FIX

Changes:
- Match Queue and TV Display now use the same authoritative Match Flow ordering function.
- Saved Match Flow remains the source of order for READY/PENDING matches.
- Combative category order is explicitly:
  1. Pinweight
  2. Bantamweight
  3. Featherweight
  4. Extra Lightweight
  5. Half Lightweight
- Anyo category order is explicitly:
  1. Single Weapon
  2. Double Weapon
  3. Espada y Daga
- Round-by-round flows sort by round first, then the requested gender priority and category order.
- Boys First / Girls First flows sort by gender first, then category, then round and match number.
- START NEXT AVAILABLE uses the same order as the visible queue.
- TV Display's NEXT list uses the same order as Match Queue.
- Existing winner-result, one-court TV, ticker, and animation changes from V50 are preserved.
- No changes were made to bracket advancement logic or ANYO scoring behavior.
