/* Sourcebook. ES5 only, for iOS 6 Safari.
   Loads data/repos.json and data/status.json. Saved repos live in localStorage. */
(function () {
  var DAY = 24 * 60 * 60 * 1000;
  var FAV_KEY = 'sourcebook_favs';
  var RANK = { green: 0, orange: 1, red: 2, grey: 3 };
  var repos = [];
  var status = {};
  var openRows = {};
  var rawQuery = '';
  var query = '';

  function getJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url + '?t=' + new Date().getTime(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try { cb(null, JSON.parse(xhr.responseText)); }
        catch (e) { cb(e); }
      } else {
        cb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.send(null);
  }

  // Green: responded in the last day. Orange: none in 3 days. Red: none in 7 days.
  function lightFor(lastOk) {
    if (!lastOk) { return 'grey'; }
    var age = new Date().getTime() - Number(lastOk);
    if (age <= DAY) { return 'green'; }
    if (age <= 3 * DAY) { return 'orange'; }
    return 'red';
  }

  function servesVersion(repo, version) {
    if (version === 'all') { return true; }
    var list = repo.serving || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]) === String(version)) { return true; }
    }
    return false;
  }

  function hit(text, q) {
    if (!q) { return true; }
    return String(text || '').toLowerCase().indexOf(q) !== -1;
  }

  function matchRepo(repo, q) {
    var result = { match: false, tweakHit: false };
    if (!q) { result.match = true; return result; }
    if (hit(repo.name, q) || hit(repo.url, q)) { result.match = true; }
    var tweaks = repo.tweaks || [];
    for (var t = 0; t < tweaks.length; t++) {
      if (hit(tweaks[t].name, q) || hit(tweaks[t].description, q)) {
        result.match = true;
        result.tweakHit = true;
      }
    }
    return result;
  }

  // Saved repos, stored per device. Wrapped in try/catch because private
  // browsing or blocked storage can throw.
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function setFavs(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); }
    catch (e) { /* storage unavailable: the feature just won't persist */ }
  }
  function isFav(url) {
    var list = getFavs();
    for (var i = 0; i < list.length; i++) {
      if (list[i] === url) { return true; }
    }
    return false;
  }
  function toggleFav(url) {
    var list = getFavs();
    var next = [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === url) { found = true; } else { next.push(list[i]); }
    }
    if (!found) { next.push(url); }
    setFavs(next);
  }

  // Copy the URL. execCommand works on old Safari, where navigator.clipboard does not exist.
  function copyText(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    btn.innerHTML = ok ? 'Copied' : 'Select';
    setTimeout(function () { btn.innerHTML = 'Copy'; }, 1500);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function lastCheckedText(st) {
    var t = st.last_check || st.last_ok;
    if (!t) { return 'never'; }
    return new Date(Number(t)).toLocaleString();
  }

  function reportUrl(repo) {
    var title = 'Problem with ' + repo.name + ' (' + repo.url + ')';
    var body = 'What happened:\n\nYour iOS version and device:\n';
    return 'https://github.com/deepdiver26/Sourcebook/issues/new?title=' +
      encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }

  // Sorts the visible items. "default" keeps the order in repos.json.
  function sortItems(items, mode) {
    items.sort(function (a, b) {
      if (mode === 'name') {
        var an = a.repo.name.toLowerCase(), bn = b.repo.name.toLowerCase();
        return an < bn ? -1 : (an > bn ? 1 : 0);
      }
      if (mode === 'status') { return RANK[a.light] - RANK[b.light]; }
      if (mode === 'tweaks') { return (b.repo.tweaks || []).length - (a.repo.tweaks || []).length; }
      if (mode === 'saved') { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); }
      return a.i - b.i;
    });
    return items;
  }

  function render() {
    var version = document.getElementById('ios-select').value;
    var sort = document.getElementById('sort-select').value;
    var list = document.getElementById('repo-list');
    var items = [];

    for (var i = 0; i < repos.length; i++) {
      var repo = repos[i];
      if (!servesVersion(repo, version)) { continue; }
      var m = matchRepo(repo, query);
      if (!m.match) { continue; }
      var st = status[repo.url] || {};
      items.push({
        i: i,
        repo: repo,
        m: m,
        st: st,
        light: lightFor(st.last_ok),
        fav: isFav(repo.url)
      });
    }

    sortItems(items, sort);

    var html = '';
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var key = 'r' + it.i;
      // Expand automatically when the search matched one of the repo's tweaks
      var open = !!openRows[key] || (query && it.m.tweakHit);

      html += '<div class="row-action" data-key="' + key + '">';
      html += '<div class="repo-main">';
      html += '<span class="dot dot-' + it.light + '"></span>';
      html += '<span class="repo-name">' + esc(it.repo.name) + (it.fav ? ' <span class="star">★</span>' : '') + '</span>';
      html += '<button class="copy-btn" data-url="' + esc(it.repo.url) + '">Copy</button>';
      html += '<span class="repo-url">' + esc(it.repo.url) + '</span>';
      html += '</div>';
      html += '<span class="chevron' + (open ? ' open' : '') + '">&rsaquo;</span>';
      html += '</div>';

      if (open) {
        var tweaks = it.repo.tweaks || [];
        html += '<div class="tweaks">';
        for (var t = 0; t < tweaks.length; t++) {
          html += '<div class="tweak">' + esc(tweaks[t].name);
          if (tweaks[t].description) {
            html += '<span class="tweak-desc">' + esc(tweaks[t].description) + '</span>';
          }
          html += '</div>';
        }
        html += '<div class="tweak repo-meta">Last checked: ' + esc(lastCheckedText(it.st)) + '</div>';
        html += '<div class="tweak"><button class="fav-btn" data-url="' + esc(it.repo.url) + '">' +
          (it.fav ? '★ Saved' : '☆ Save to my list') + '</button></div>';
        html += '<div class="tweak"><a class="report-link" href="' + esc(reportUrl(it.repo)) + '">Report a problem with this repo</a></div>';
        html += '</div>';
      }
    }

    if (!items.length) {
      var msg = query
        ? 'No matches for "' + esc(rawQuery) + '"'
        : 'No repositories for this iOS version';
      html = '<div class="row"><span class="row-label muted">' + msg + '</span></div>';
    }
    list.innerHTML = html;
  }

  function onListClick(e) {
    var target = e.target || e.srcElement;
    var node = target;

    // Copy button: copy and stop, so the row does not toggle
    while (node && node !== this) {
      if (node.className && node.className.indexOf('copy-btn') !== -1) {
        copyText(node.getAttribute('data-url'), node);
        return;
      }
      node = node.parentNode;
    }

    // Save button: toggle the saved state and redraw
    node = target;
    while (node && node !== this) {
      if (node.className && node.className.indexOf('fav-btn') !== -1) {
        toggleFav(node.getAttribute('data-url'));
        render();
        return;
      }
      node = node.parentNode;
    }

    // Report link: let the browser follow it, do not toggle the row
    node = target;
    while (node && node !== this) {
      if (node.className && node.className.indexOf('report-link') !== -1) {
        return;
      }
      node = node.parentNode;
    }

    // Row tap: expand or collapse
    node = target;
    while (node && node !== this) {
      if (node.getAttribute && node.getAttribute('data-key')) {
        var key = node.getAttribute('data-key');
        openRows[key] = !openRows[key];
        render();
        return;
      }
      node = node.parentNode;
    }
  }

  function onSearch() {
    var box = document.getElementById('search-box');
    rawQuery = box.value.replace(/^\s+|\s+$/g, '');
    query = rawQuery.toLowerCase();
    render();
  }

  function showUpdated() {
    var el = document.getElementById('updated-text');
    if (status.updated) {
      el.innerHTML = 'Status checked ' + new Date(status.updated).toLocaleString();
    } else {
      el.innerHTML = 'Status not available yet';
    }
  }

  function init() {
    document.getElementById('ios-select').onchange = render;
    document.getElementById('sort-select').onchange = render;
    document.getElementById('repo-list').onclick = onListClick;

    var box = document.getElementById('search-box');
    box.onkeyup = onSearch;
    box.oninput = onSearch;
    box.onsearch = onSearch; // fires when the iOS clear X is tapped

    getJSON('data/repos.json', function (err, data) {
      if (err) {
        document.getElementById('repo-list').innerHTML =
          '<div class="row"><span class="row-label muted">Could not load repositories</span></div>';
        return;
      }
      repos = data;
      getJSON('data/status.json', function (err2, s) {
        status = (!err2 && s && s.repos) ? s.repos : {};
        if (!err2 && s) { status.updated = s.updated; }
        render();
        showUpdated();
      });
    });
  }

  init();
})();
