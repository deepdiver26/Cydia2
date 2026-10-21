/* Softboard: renders data/softboard.json. ES5 only, for iOS 6 Safari. */
(function () {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(ms) {
    return new Date(Number(ms)).toLocaleDateString();
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'data/softboard.json?t=' + new Date().getTime(), true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    var el = document.getElementById('posts');
    try {
      var posts = JSON.parse(xhr.responseText);
      var html = '';
      for (var i = 0; i < posts.length; i++) {
        html += '<div class="post">';
        html += '<div class="post-date">' + esc(fmtDate(posts[i].date)) + '</div>';
        html += '<div class="post-author">' + esc(posts[i].author) + '</div>';
        html += '<div class="post-body">' + esc(posts[i].text) + '</div>';
        html += '</div>';
      }
      el.innerHTML = html || '<div class="row"><span class="row-label muted">No posts yet</span></div>';
    } catch (e) {
      el.innerHTML = '<div class="row"><span class="row-label muted">Could not load posts</span></div>';
    }
  };
  xhr.send(null);
})();
