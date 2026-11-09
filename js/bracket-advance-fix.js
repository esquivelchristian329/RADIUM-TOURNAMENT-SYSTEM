/* RADIUM — RELIABLE BRACKET ADVANCEMENT (V88)
 * Reconciles completed-match winners into the next-round match in Supabase.
 * Idempotent: retries are safe, existing opponents/results are never overwritten.
 */
(function () {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let running = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function localMatches(state) {
    const byId = new Map();
    for (const category of state.categories || []) {
      for (const [ri, round] of (category.bracket?.rounds || []).entries()) {
        for (const [mi, match] of (round || []).entries()) {
          if (match?.id) byId.set(String(match.id), { category, match, round: ri + 1, index: mi });
        }
      }
    }
    return byId;
  }

  async function reconcileBracketAdvances() {
    if (running) return;
    running = true;
    try {
      const db = window.RADIUM_DB, cloud = window.RADIUM_CLOUD, getData = window.__RADIUM_GET_DATA;
      if (!db || !cloud || typeof getData !== 'function') return;
      const tid = cloud.getId?.();
      if (!tid || !UUID.test(String(tid)) || !(await db.init())?.enabled) return;
      const state = getData();
      const localById = localMatches(state);
      const result = await db.select('matches', {
        select: 'id,tournament_id,category_id,round,match_number,bracket_position,status,red_player_id,blue_player_id,winner_player_id,metadata',
        eq: { tournament_id: tid }
      });
      if (result?.error) throw result.error;
      const rows = result?.data || [];
      const byId = new Map(rows.map(row => [String(row.id), row]));
      let repairs = 0;

      for (const source of rows) {
        if (String(source.status || '').toUpperCase() !== 'COMPLETED' || !source.winner_player_id) continue;
        const winner = String(source.winner_player_id);
        if (![String(source.red_player_id || ''), String(source.blue_player_id || '')].includes(winner)) continue;
        const meta = source.metadata || {};
        const local = localById.get(String(source.id));
        const localMatch = local?.match || {};
        let targetId = meta.nextMatchId || localMatch.nextMatchId || null;
        let slot = String(meta.nextSlot || localMatch.nextSlot || '').toLowerCase();
        let target = targetId ? byId.get(String(targetId)) : null;

        // Legacy fallback: adjacent match positions, only when no saved topology exists.
        // Do not guess across categories or overwrite an occupied slot.
        if (!target) {
          const candidates = rows.filter(row => String(row.category_id) === String(source.category_id) && Number(row.round) === Number(source.round) + 1);
          const pos = Number.isFinite(Number(source.bracket_position)) ? Number(source.bracket_position) : Number(source.match_number) - 1;
          const inferred = candidates.find(row => Number(row.bracket_position) === Math.floor(pos / 2));
          if (inferred) {
            target = inferred;
            targetId = inferred.id;
            if (slot !== 'red' && slot !== 'blue') slot = pos % 2 === 0 ? 'red' : 'blue';
          }
        }
        if (!target || String(target.category_id) !== String(source.category_id)) continue;
        if (slot !== 'red' && slot !== 'blue') {
          // Use bracket topology if available; otherwise infer only from an empty slot.
          const targetLocal = localById.get(String(target.id));
          const lm = targetLocal?.match || {};
          if (String(lm.red || '') === winner) slot = 'red';
          else if (String(lm.blue || '') === winner) slot = 'blue';
          else if (!target.red_player_id && !target.blue_player_id) slot = 'red';
          else if (!target.red_player_id) slot = 'red';
          else if (!target.blue_player_id) slot = 'blue';
          else continue;
        }

        const targetStatus = String(target.status || '').toUpperCase();
        if (['COMPLETED', 'IN_PROGRESS', 'LIVE', 'CANCELLED'].includes(targetStatus)) continue;
        const field = slot === 'red' ? 'red_player_id' : 'blue_player_id';
        const current = target[field] ? String(target[field]) : '';
        if (current && current !== winner) {
          console.warn('RADIUM advancement conflict; preserving occupied slot.', { source: source.id, target: target.id, slot, winner, current });
          continue;
        }
        const other = slot === 'red' ? target.blue_player_id : target.red_player_id;
        const nextStatus = (winner && other) ? 'READY' : 'PENDING';
        const sourceNeedsTopology = String(meta.nextMatchId || '') !== String(target.id) || String(meta.nextSlot || '').toLowerCase() !== slot;
        if (!current || String(target.status || '').toUpperCase() !== nextStatus) {
          const patch = { [field]: winner, status: nextStatus };
          const update = await db.update('matches', patch, { id: target.id, tournament_id: tid });
          if (update?.error) throw update.error;
          target[field] = winner;
          target.status = nextStatus;
          repairs++;
        }
        if (sourceNeedsTopology) {
          const update = await db.update('matches', { metadata: { ...meta, nextMatchId: target.id, nextSlot: slot } }, { id: source.id, tournament_id: tid });
          if (update?.error) throw update.error;
          source.metadata = { ...meta, nextMatchId: target.id, nextSlot: slot };
        }
      }
      if (repairs) console.info(`RADIUM advancement recovery: repaired ${repairs} next-match slot(s).`);
    } catch (error) {
      console.warn('RADIUM advancement reconciliation failed; it will retry:', error?.message || error);
    } finally {
      running = false;
    }
  }

  function install() {
    const cloud = window.RADIUM_CLOUD;
    if (!cloud || typeof cloud.push !== 'function') { setTimeout(install, 250); return; }
    if (cloud.__reliableBracketAdvancementInstalled) return;
    cloud.__reliableBracketAdvancementInstalled = true;
    const originalPush = cloud.push.bind(cloud);
    cloud.push = async function (payload) {
      const result = await originalPush(payload);
      if (result !== false) await reconcileBracketAdvances();
      return result;
    };
    window.RADIUM_RECONCILE_BRACKET_ADVANCES = reconcileBracketAdvances;
    // Recover a completed result whose advancement was interrupted, even after reload.
    setTimeout(reconcileBracketAdvances, 1800);
    setInterval(reconcileBracketAdvances, 12000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reconcileBracketAdvances(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
