(function () {
  const form = document.getElementById('searchForm');
  const keyword = document.getElementById('keyword');
  const distance = document.getElementById('distance');
  const category = document.getElementById('category');
  const autodetect = document.getElementById('autodetect');
  const locationInput = document.getElementById('location');
  const results = createResultsHost();

  let GEO = { lat: null, lng: null, source: null };

  function syncLocationUI() {
    if (autodetect.checked) {
      locationInput.classList.add('hidden');
      locationInput.required = false;
      locationInput.value = '';
      getIpinfoCoords();
    } else {
      locationInput.classList.remove('hidden');
      locationInput.required = true;
      GEO = { lat: null, lng: null, source: null };
    }
  }
  autodetect.addEventListener('change', syncLocationUI);
  syncLocationUI();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const params = new URLSearchParams();
    params.set('keyword', keyword.value.trim());
    params.set('distance', distance.value.trim() || '10');
    params.set('category', category.value);

    if (autodetect.checked && GEO.lat != null && GEO.lng != null) {
      params.set('lat', String(GEO.lat));
      params.set('lng', String(GEO.lng));
    } else {
      params.set('location', locationInput.value.trim());
    }

    try {
      const resp = await fetch(`/search?${params.toString()}`);
      const data = await resp.json();
      console.log('TM data:', data);
      renderTable(results, data);
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      results.innerHTML = `<div class="no-records">Request failed: ${String(err)}</div>`;
    }
  });

  form.addEventListener('reset', function () {
    setTimeout(() => {
      distance.value = '';
      category.value = 'default';
      autodetect.checked = false;
      locationInput.value = '';
      keyword.value = '';

      syncLocationUI();
      results.innerHTML = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  });

  async function getIpinfoCoords() {
    try {
      const r = await fetch('/ipinfo');
      const data = await r.json();
      if (data && data.loc) {
        const [lat, lng] = data.loc.split(',').map(Number);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          GEO = { lat, lng, source: 'ipinfo' };
          console.log('Auto-detected via ipinfo:', GEO);
        }
      }
    } catch (e) {
      console.warn('ipinfo failed:', e);
    }
  }


  function createResultsHost() {
    const host = document.createElement('div');
    host.id = 'results';
    document.querySelector('.card')?.insertAdjacentElement('afterend', host);
    return host;
  }

  function fmtDate(ev) {
    const d = ev?.dates?.start?.localDate || '';
    const t = ev?.dates?.start?.localTime || '';
    return (d + ' ' + t).trim();
  }

  function pickImg(ev) {
    const imgs = Array.isArray(ev?.images) ? ev.images.slice() : [];
    imgs.sort((a, b) => (a?.width ?? 0) - (b?.width ?? 0));
    return imgs[0]?.url || '';
  }

  function getGenre(ev) {
    const c = ev?.classifications?.[0] || {};
    const parts = [
      c.subGenre?.name,
      c.genre?.name,
      c.segment?.name,
      c.subType?.name,
      c.type?.name,
    ].filter(Boolean);
    return [...new Set(parts)].join(' | ') || 'N/A';
  }

  function getVenueName(ev) {
    return ev?._embedded?.venues?.[0]?.name || 'N/A';
  }

  function sortRows(rows, key, dir) {
    const sign = dir === 'desc' ? -1 : 1;
    const getKey = {
      event: r => r._name || '',
      genre: r => r._genre || '',
      venue: r => r._venue || '',
    }[key];

    rows.sort((a, b) => {
      const va = getKey(a).toLowerCase();
      const vb = getKey(b).toLowerCase();
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }

function renderTable(root, data) {
    const list = data?._embedded?.events || [];
    if (!list.length) {
      root.innerHTML = `<div class="no-records">No records found</div>`;
      return;
    }

    const rows = list.map(ev => ({
      _id: ev.id,
      _date: fmtDate(ev),
      _img: pickImg(ev),
      _name: ev.name || 'N/A',
      _genre: getGenre(ev),
      _venue: getVenueName(ev),
    }));

    let sortState = { key: 'event', dir: 'asc' };

    function tableHtml(rws) {
      const trs = rws.map(r => `
        <tr>
          <td>${escapeHtml(r._date)}</td>
          <td>${r._img ? `<img src="${r._img}" alt="" width="60">` : ''}</td>
          <td><a href="#" data-id="${r._id}" class="ev-link">${escapeHtml(r._name)}</a></td>
          <td>${escapeHtml(r._genre)}</td>
          <td>${escapeHtml(r._venue)}</td>
        </tr>
      `).join('');

      return `
        <table class="result">
          <thead>
            <tr>
              <th>Date</th>
              <th>Icon</th>
              <th data-sort="event" class="sortable">Event</th>
              <th data-sort="genre" class="sortable">Genre</th>
              <th data-sort="venue" class="sortable">Venue</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
        <div id="detail"></div>
      `;
    }

    function highlightSortHeader() {
      root.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
      });
      const active = root.querySelector(`th.sortable[data-sort="${sortState.key}"]`);
      if (active) active.classList.add(sortState.dir);
    }

    function bindRowClicks() {
      root.querySelectorAll('.ev-link').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = a.dataset.id;
          const detRoot = document.getElementById('detail');
          detRoot.innerHTML = `<div class="loading">Loading details…</div>`;
          try {
            const det = await fetch(`/event?id=${encodeURIComponent(id)}`).then(r => r.json());
            renderDetail(detRoot, det);
            detRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) {
            detRoot.innerHTML = `<div class="no-records">Details failed: ${String(err)}</div>`;
          }
        });
      });
    }

    function bindHeaderSort(currentRows) {
      root.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sort;
          const dir = (sortState.key === key && sortState.dir === 'asc') ? 'desc' : 'asc';
          sortState = { key, dir };

          const clone = currentRows.slice();
          sortRows(clone, sortState.key, sortState.dir);

          root.innerHTML = tableHtml(clone);
          bindHeaderSort(clone);
          bindRowClicks();
          highlightSortHeader();
        });
      });
    }

    root.innerHTML = tableHtml(rows);
    bindHeaderSort(rows);
    bindRowClicks();
    highlightSortHeader();
  }


  function renderDetail(root, data) {
  const ev = data || {};
  const title = ev?.name || "Event";

  const dateStr = ((ev?.dates?.start?.localDate || "") + " " + (ev?.dates?.start?.localTime || "")).trim() || "N/A";
  const artistsArr = (ev?._embedded?.attractions || []).map(a => a?.name).filter(Boolean);
  const artistLinks = (ev?._embedded?.attractions || [])
    .map(a => a?.url
      ? `<a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.name || 'Artist')}</a>`
      : escapeHtml(a.name || 'Artist'))
    .join(" | ") || "N/A";

  const venueName = ev?._embedded?.venues?.[0]?.name || "N/A";

  function getGenre() {
    const c = ev?.classifications?.[0] || {};
    const parts = [c.subGenre?.name, c.genre?.name, c.segment?.name, c.subType?.name, c.type?.name].filter(Boolean);
    return [...new Set(parts)].join(" | ") || "N/A";
  }
  const genre = getGenre();

    const pr = Array.isArray(ev?.priceRanges) ? ev.priceRanges[0] : null;
    const hasPrice = pr && (Number.isFinite(pr.min) || Number.isFinite(pr.max));
    const priceText = hasPrice ? `${pr.min ?? ''}${(pr.min != null && pr.max != null) ? ' - ' : ''}${pr.max ?? ''}` : null;

  const ticketStatus = ev?.dates?.status?.code || "N/A";
  const statusKey = (ticketStatus || '').toLowerCase();
    const statusMap = {
    onsale:      { cls: 'status-onsale',      text: 'On Sale' },
    offsale:     { cls: 'status-offsale',     text: 'Off Sale' },
    canceled:    { cls: 'status-canceled',    text: 'Canceled' },
    postponed:   { cls: 'status-postponed',   text: 'Postponed' },
    rescheduled: { cls: 'status-rescheduled', text: 'Rescheduled' }
    };
    const statusConf = statusMap[statusKey] || { cls: 'status-default', text: ticketStatus || 'N/A' };


  const seatMap = ev?.seatmap?.staticUrl || "";
  const buyUrl = ev?.url || "";

  root.innerHTML = `
    <div class="detail-card">
      <h2 class="detail-title">${escapeHtml(title)}</h2>

      <div class="detail-left">
        <div class="field">
          <div class="label">Date</div>
          <div class="value">${escapeHtml(dateStr)}</div>
        </div>
        <div class="field">
          <div class="label">Artist/Team</div>
          <div class="value">${artistLinks}</div>
        </div>
        <div class="field">
          <div class="label">Venue</div>
          <div class="value">${escapeHtml(venueName)}</div>
        </div>
        <div class="field">
          <div class="label">Genres</div>
          <div class="value">${escapeHtml(genre)}</div>
        </div>
        <div class="field ${hasPrice ? '' : 'is-empty'}">
            <div class="label">Price Ranges</div>
            <div class="value">${escapeHtml(priceText || 'N/A')}</div>
        </div>
        <div class="field">
            <div class="label">Ticket Status</div>
            <div class="value">
                <span class="status-badge ${statusConf.cls}">${escapeHtml(statusConf.text)}</span>
            </div>
        </div>
        <div class="field">
          <div class="label">Buy Ticket At</div>
          <div class="value">${buyUrl ? `<a href="${buyUrl}" target="_blank" rel="noopener">Ticketmaster</a>` : 'N/A'}</div>
        </div>
      </div>

      <div class="detail-right">
        ${seatMap ? `<img src="${seatMap}" alt="Seat Map" class="seatmap">` : ''}
      </div>
    </div>

    <div class="venue-toggle">
      <button id="btnVenue" class="venue-toggle-btn" type="button">
        Show Venue Details
      </button>
    </div>
    <div id="venuePanel" class="hidden"></div>
  `;

  document.getElementById('btnVenue').addEventListener('click', async () => {
    const panel = document.getElementById('venuePanel');
    panel.classList.remove('hidden');
    panel.innerHTML = `<div class="loading">Loading venue…</div>`;
    try {
      const v = await fetch(`/venue?keyword=${encodeURIComponent(venueName)}`).then(r => r.json());
      renderVenue(panel, v);
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('btnVenue').remove();
    } catch (e) {
      panel.innerHTML = `<div class="no-records">Venue failed: ${escapeHtml(String(e))}</div>`;
    }
  });
}


  function renderVenue(root, data) {
  const ven = data?._embedded?.venues?.[0] || {};
  const name  = ven?.name || 'N/A';
  const line1 = ven?.address?.line1 || '';
  const city  = ven?.city?.name || '';
  const state = ven?.state?.stateCode || '';
  const zip   = ven?.postalCode || '';
  const cityState = [city, state].filter(Boolean).join(', ');
  const addrLines = [line1, cityState, zip].filter(Boolean);
  const moreUrl  = ven?.url || '';
  const logo = (Array.isArray(ven.images) ? ven.images : []).sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url || '';

  const gmapsUrl = buildGmapsUrl({ name, line1, city, stateCode: state, zip });

  root.innerHTML = `
    <div class="venue-card">
      <div class="venue-inner">
        <h3 class="venue-title">${escapeHtml(name)}</h3>
        ${logo ? `<img class="venue-logo" src="${logo}" alt="${escapeHtml(name)} logo">` : ''}

        <div class="venue-grid">
          <div class="venue-left">
            ${addrLines.length ? `
              <div class="venue-address">
                <span class="k">Address:</span>
                <div class="addr-lines">
                  ${addrLines.map(l => `<div>${escapeHtml(l)}</div>`).join('')}
                </div>
              </div>
            ` : ''}

            <a class="venue-link" href="${gmapsUrl}" target="_blank" rel="noopener">
              Open in Google Maps
            </a>
          </div>

          <div class="venue-divider" aria-hidden="true"></div>

          <div class="venue-right">
            ${moreUrl ? `<a class="venue-link" href="${moreUrl}" target="_blank" rel="noopener">More events at this venue</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}


  function buildGmapsUrl({ name, line1, city, stateCode, zip }) {
    const q = [name, line1, city, stateCode, zip].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
