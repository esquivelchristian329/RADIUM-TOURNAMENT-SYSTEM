/* RADIUM V34 - PERSISTENT SUPABASE SNAPSHOTS
   Add this script AFTER js/cloud-sync.js.
   Supabase is the only source of truth for tournament data.
   Uses the existing RPCs:
     radium_save_snapshot(tid, incoming)
     radium_list_snapshots(tid)
*/
(function () {
  'use strict';

  function waitForCloud() {
    if (window.RADIUM_CLOUD && window.RADIUM_DB) {
      install();
      return;
    }
    setTimeout(waitForCloud, 100);
  }

  let installed = false;
  let originalPush = null;
  let savingSnapshot = false;

  function roleAllowed() {
    const role = String(window.RADIUM_AUTH?.role || '').toLowerCase();
    return role === 'admin' || role === 'tournament_manager';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }

  function activeTournamentId() {
    return window.RADIUM_CLOUD?.getId?.() || '';
  }

  async function saveSnapshot(reason) {
    const cloud = window.RADIUM_CLOUD;
    const tid = activeTournamentId();
    if (!cloud || !tid || !roleAllowed() || savingSnapshot) return null;

    savingSnapshot = true;
    try {
      const payload = cloud.payload();
      const result = await window.RADIUM_DB.rpc('radium_save_snapshot', {
        tid: tid,
        incoming: { reason: reason || 'automatic snapshot', payload: payload }
      });
      if (result?.error) throw result.error;
      return Array.isArray(result?.data) ? result.data[0] : result?.data;
    } finally {
      savingSnapshot = false;
    }
  }

  async function listSnapshots() {
    const tid = activeTournamentId();
    if (!tid) throw new Error('No active tournament selected.');
    const result = await window.RADIUM_DB.rpc('radium_list_snapshots', { tid: tid });
    if (result?.error) throw result.error;
    let data = result?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) {}
    }
    return Array.isArray(data) ? data : [];
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch (_) {
      return String(value || '');
    }
  }

  async function restoreSnapshot(snapshot) {
    if (!snapshot?.payload) throw new Error('Snapshot payload is missing.');
    const cloud = window.RADIUM_CLOUD;
    const tid = activeTournamentId();

    if (!tid || String(snapshot.tournament_id || tid) !== String(tid)) {
      throw new Error('Snapshot does not belong to the active tournament.');
    }

    if (!confirm(
      'RESTORE THIS SNAPSHOT?\n\n' +
      formatDate(snapshot.created_at) +
      '\n' +
      (snapshot.reason || 'automatic snapshot') +
      '\n\n' +
      'The current tournament state will be replaced by this saved snapshot.'
    )) return false;

    // Save the current state first so the restore itself is reversible.
    await saveSnapshot('before restore');

    const payload = JSON.parse(JSON.stringify(snapshot.payload));
    payload.tournamentId = tid;

    if (typeof window.__RADIUM_SET_DATA !== 'function') {
      throw new Error('Tournament state is not ready.');
    }

    window.__RADIUM_SET_DATA(payload, { fromCloud: true });
    cloud.setId(tid);
    cloud.state.loaded = true;
    cloud.state.tournamentId = tid;
    cloud.state.lastError = null;

    // Normalize the restored state back into Supabase.
    await cloud.flush();
    window.renderAll?.();

    alert('Snapshot restored and saved to Supabase.');
    return true;
  }

  function ensureStyles() {
    if (document.getElementById('radiumSnapshotStyles')) return;
    const style = document.createElement('style');
    style.id = 'radiumSnapshotStyles';
    style.textContent = `
      #radiumSnapshotButton {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 99990;
        border: 0;
        border-radius: 10px;
        padding: 11px 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,.25);
      }
      #radiumSnapshotPanel {
        position: fixed;
        right: 14px;
        bottom: 62px;
        width: min(420px, calc(100vw - 28px));
        max-height: 70vh;
        overflow: auto;
        z-index: 99991;
        background: var(--panel, #fff);
        color: var(--text, #111);
        border: 1px solid rgba(0,0,0,.15);
        border-radius: 12px;
        padding: 14px;
        box-shadow: 0 8px 30px rgba(0,0,0,.28);
      }
      #radiumSnapshotPanel[hidden] { display: none; }
      .radium-snap-row {
        border: 1px solid rgba(0,0,0,.12);
        border-radius: 9px;
        padding: 10px;
        margin: 8px 0;
      }
      .radium-snap-meta { font-size: 12px; opacity: .75; margin: 3px 0 8px; }
      .radium-snap-actions { display:flex; gap:7px; flex-wrap:wrap; }
      .radium-snap-actions button {
        border: 0; border-radius: 7px; padding: 7px 10px; cursor:pointer;
      }
      .radium-snap-status { font-size: 12px; margin: 8px 0; }
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if (document.getElementById('radiumSnapshotButton')) return;

    ensureStyles();

    const button = document.createElement('button');
    button.id = 'radiumSnapshotButton';
    button.type = 'button';
    button.textContent = '☁ BACKUPS';
    button.title = 'Persistent Supabase tournament snapshots';

    const panel = document.createElement('div');
    panel.id = 'radiumSnapshotPanel';
    panel.hidden = true;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <strong>Persistent Supabase Backups</strong>
        <button type="button" id="radiumSnapshotClose">CLOSE</button>
      </div>
      <div class="radium-snap-status" id="radiumSnapshotStatus">
        Snapshots are stored in Supabase.
      </div>
      <div class="radium-snap-actions">
        <button type="button" id="radiumSnapshotNow">SAVE SNAPSHOT NOW</button>
        <button type="button" id="radiumSnapshotRefresh">REFRESH</button>
      </div>
      <div id="radiumSnapshotList"></div>
    `;

    document.body.appendChild(button);
    document.body.appendChild(panel);

    const status = panel.querySelector('#radiumSnapshotStatus');
    const list = panel.querySelector('#radiumSnapshotList');

    async function refresh() {
      status.textContent = 'Loading snapshots from Supabase...';
      list.innerHTML = '';
      try {
        const rows = await listSnapshots();
        if (!rows.length) {
          list.innerHTML = '<div>No persistent snapshots yet.</div>';
          status.textContent = 'No snapshots found in Supabase.';
          return;
        }

        list.innerHTML = rows.map(function (s, index) {
          return `
            <div class="radium-snap-row">
              <div><strong>${escapeHtml(formatDate(s.created_at))}</strong></div>
              <div class="radium-snap-meta">
                ${escapeHtml(s.reason || 'automatic snapshot')}
                ${index === 0 ? ' — newest' : ''}
              </div>
              <div class="radium-snap-actions">
                <button type="button" data-radium-restore="${escapeHtml(s.id)}">RESTORE</button>
              </div>
            </div>
          `;
        }).join('');

        list.querySelectorAll('[data-radium-restore]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            btn.disabled = true;
            try {
              const selected = rows.find(function (s) {
                return String(s.id) === String(btn.dataset.radiumRestore);
              });
              if (selected) await restoreSnapshot(selected);
              await refresh();
            } catch (e) {
              console.error('RADIUM snapshot restore failed:', e);
              alert('Could not restore snapshot: ' + (e?.message || e));
              btn.disabled = false;
            }
          });
        });

        status.textContent = rows.length + ' persistent snapshot(s) loaded from Supabase. The database retains the latest 5.';
      } catch (e) {
        console.error('RADIUM snapshot list failed:', e);
        status.textContent = 'Could not load snapshots: ' + (e?.message || e);
      }
    }

    button.addEventListener('click', async function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) await refresh();
    });

    panel.querySelector('#radiumSnapshotClose').addEventListener('click', function () {
      panel.hidden = true;
    });

    panel.querySelector('#radiumSnapshotRefresh').addEventListener('click', refresh);

    panel.querySelector('#radiumSnapshotNow').addEventListener('click', async function () {
      const b = panel.querySelector('#radiumSnapshotNow');
      b.disabled = true;
      try {
        await saveSnapshot('manual snapshot');
        status.textContent = 'Snapshot saved to Supabase.';
        await refresh();
      } catch (e) {
        console.error('RADIUM manual snapshot failed:', e);
        status.textContent = 'Could not save snapshot: ' + (e?.message || e);
      } finally {
        b.disabled = false;
      }
    });
  }

  function install() {
    if (installed) return;
    installed = true;

    const cloud = window.RADIUM_CLOUD;
    originalPush = cloud.push.bind(cloud);

    // Every successful cloud save creates a persistent server-side snapshot.
    // The existing database RPC keeps only the latest 5 snapshots.
    cloud.push = async function () {
      const result = await originalPush();
      if (!result) return result;
      try {
        await saveSnapshot('automatic snapshot');
      } catch (e) {
        console.error('RADIUM automatic snapshot failed:', e);
        // Do not make a successful tournament save fail merely because
        // snapshot creation failed. The error is visible in the console.
      }
      return result;
    };

    window.RADIUM_SNAPSHOTS = {
      save: saveSnapshot,
      list: listSnapshots,
      restore: restoreSnapshot
    };

    document.addEventListener('radium-auth-ready', function () {
      setTimeout(buildUi, 250);
    });
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(buildUi, 250);
    });

    setTimeout(buildUi, 500);
  }

  waitForCloud();
})();
