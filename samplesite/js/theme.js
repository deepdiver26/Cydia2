/* Dark mode switch. ES5 only, for iOS 6 Safari. Remembers the choice per device. */
(function () {
  var KEY = 'sourcebook_dark';

  function isDark() {
    try { return localStorage.getItem(KEY) === '1'; }
    catch (e) { return false; }
  }

  function save(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); }
    catch (e) { /* storage unavailable: the choice just won't persist */ }
  }

  function apply(on) {
    var cls = document.documentElement.className.replace(/\bdark\b/g, '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    document.documentElement.className = on ? (cls ? cls + ' dark' : 'dark') : cls;
  }

  apply(isDark());

  window.sourcebookTheme = {
    isDark: isDark,
    toggle: function () {
      var on = !isDark();
      save(on);
      apply(on);
      return on;
    }
  };
})();
