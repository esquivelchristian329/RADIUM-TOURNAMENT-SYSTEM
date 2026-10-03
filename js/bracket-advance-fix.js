/* RADIUM — BRACKET WINNER ADVANCEMENT FIX
 *
 * Fixes a cloud-sync issue where a completed Round 1 winner was advanced
 * correctly in the local bracket, but the already-created Round 2 match in
 * Supabase kept NULL/old player IDs.
 *
 * Upload this file to:
 *   js/bracket-advance-fix.js
 *
 * Then add AFTER cloud-sync.js in index.html:
 *   <script src="js/bracket-advance-fix.js"></script>
 */
(function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  async function persistPendingBracketAdvances() {
    try {
      const db = window.RADIUM_DB;
      const cloud = window.RADIUM_CLOUD;
      const getData = window.__RADIUM_GET_DATA;

      if (!db || !cloud || typeof getData !== 'function') return;
      const state = getData();
      const tid = cloud.getId?.();

      if (!tid || !UUID.test(String(tid))) return;
      if (!(await db.init())?.enabled) return;

      for (const category of (state.categories || [])) {
        const bracket = category?.bracket;
        if (!bracket || bracket.mode !== 'single') continue;

        for (const round of (bracket.rounds || [])) {
          for (const match of (round || [])) {
            if (!match?.id || !UUID.test(String(match.id))) continue;

            /*
             * Only update matches that have not started/completed.
             * Completed/in-progress matches remain authoritative in Supabase.
             */
            const existing = await db.select('matches', {
              select: 'id,status,red_player_id,blue_player_id,red_score,blue_score,winner_player_id',
              eq: { id: match.id, tournament_id: tid },
              limit: 1
            });

            if (existing?.error || !existing.data?.[0]) continue;

            const row = existing.data[0];
            const status = String(row.status || '').toUpperCase();

            if (status === 'COMPLETED' || status === 'IN_PROGRESS') continue;

            const red = UUID.test(String(match.red || '')) ? match.red : null;
            const blue = UUID.test(String(match.blue || '')) ? match.blue : null;

            const desiredStatus =
              match.redBye || match.blueBye
                ? 'BYE'
                : (red && blue ? 'READY' : 'PENDING');

            const changed =
              String(row.red_player_id || '') !== String(red || '') ||
              String(row.blue_player_id || '') !== String(blue || '') ||
              String(row.status || '').toUpperCase() !== desiredStatus;

            if (!changed) continue;

            const update = await db.update('matches', {
              red_player_id: red,
              blue_player_id: blue,
              status: desiredStatus
            }, { id: match.id });

            if (update?.error) {
              console.warn('RADIUM bracket advancement cloud update failed:', update.error);
            }
          }
        }
      }
    } catch (e) {
      console.warn('RADIUM bracket advancement fix skipped:', e);
    }
  }

  function install() {
    const cloud = window.RADIUM_CLOUD;
    if (!cloud || typeof cloud.push !== 'function') {
      setTimeout(install, 250);
      return;
    }

    if (cloud.__bracketAdvanceFixInstalled) return;
    cloud.__bracketAdvanceFixInstalled = true;

    const originalPush = cloud.push.bind(cloud);

    cloud.push = async function (overridePayload) {
      const result = await originalPush(overridePayload);

      /*
       * The normal sync creates/updates matches first. Run the advancement
       * repair immediately afterward so existing Round 2 records receive
       * the winner that was placed into the local bracket.
       */
      await persistPendingBracketAdvances();

      return result;
    };

    window.RADIUM_PERSIST_BRACKET_ADVANCES = persistPendingBracketAdvances;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
