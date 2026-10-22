/* Repo Directory. ES5 only, for iOS 6 Safari.
   Loads data/repos.json (the list) and data/status.json (the latest pings). */
(function () {
  var DAY = 24 * 60 * 60 * 1000;
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

  // Case-insensitive contains check. An empty query matches everything.
  function hit(text, q) {
    if (!q) { return true; }
    return String(text || '').toLowerCase().indexOf(q) !== -1;
  }

  // Returns whether the repo matches, and whether a tweak inside it matched.
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

  function render() {
    var version = document.getElementById('ios-select').value;
    var list = document.getElementById('repo-list');
    var html = '';
    var shown = 0;

    for (var i = 0; i < repos.length; i++) {
      var repo = repos[i];
      if (!servesVersion(repo, version)) { continue; }

      var m = matchRepo(repo, query);
      if (!m.match) { continue; }
      shown++;

      var st = status[repo.url] || {};
      var light = lightFor(st.last_ok);
      var key = 'r' + i;
      // Expand automatically when the search matched one of the repo's tweaks
      var open = !!openRows[key] || (query && m.tweakHit);

      html += '<div class="row-action" data-key="' + key + '">';
      html += '<div class="repo-main">';
      html += '<span class="dot dot-' + light + '"></span>';
      html += '<span class="repo-name">' + esc(repo.name) + '</span>';
      html += '<button class="copy-btn" data-url="' + esc(repo.url) + '">Copy</button>';
      html += '<span class="repo-url">' + esc(repo.url) + '</span>';
      html += '</div>';
      html += '<span class="chevron' + (open ? ' open' : '') + '">&rsaquo;</span>';
      html += '</div>';

      if (open && repo.tweaks && repo.tweaks.length) {
        html += '<div class="tweaks">';
        for (var t = 0; t < repo.tweaks.length; t++) {
          html += '<div class="tweak">' + esc(repo.tweaks[t].name);
          if (repo.tweaks[t].description) {
            html += '<span class="tweak-desc">' + esc(repo.tweaks[t].description) + '</span>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
    }

    if (!shown) {
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

    // Row tap: expand or collapse tweaks
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
