/* Arabic headlines from public RSS feeds: CleanFrame's only network feature. Text only, no links or images. */
(function () {
  'use strict';
  var TIMEOUT = 12000, LIMIT = 12;
  var SOURCES = [
    { id: 'cnn', name: 'CNN Arabic', ar: 'سي إن إن بالعربية', url: 'https://arabic.cnn.com/api/v1/rss/rss.xml' },
    { id: 'sky', name: 'Sky News Arabia', ar: 'سكاي نيوز عربية', url: 'https://www.skynewsarabia.com/rss' },
    { id: 'aawsat', name: 'Asharq Al-Awsat', ar: 'الشرق الأوسط', url: 'https://aawsat.com/feed' },
    { id: 'dw', name: 'DW Arabic', ar: 'DW عربية', url: 'https://rss.dw.com/xml/rss-ar-all' }
  ];
  function source(id) { for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i]; return null; }
  function field(node, names) {
    var i, list;
    for (i = 0; i < names.length; i++) {
      list = node.getElementsByTagName(names[i]);
      if (list.length) return list[0].textContent || '';
    }
    return '';
  }
  /* Feeds sometimes nest markup or double-encode entities inside titles; keep plain text only. */
  function plain(text) {
    return String(text).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function parse(xml) {
    var doc, nodes, items = [], i, title, at;
    try { doc = new window.DOMParser().parseFromString(String(xml), 'application/xml'); } catch (e) { return null; }
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    nodes = doc.getElementsByTagName('item');
    if (!nodes.length) nodes = doc.getElementsByTagName('entry');
    for (i = 0; i < nodes.length && items.length < LIMIT; i++) {
      title = plain(field(nodes[i], ['title'])).slice(0, 240);
      at = Date.parse(field(nodes[i], ['pubDate', 'published', 'updated', 'dc:date']).trim());
      if (title) items.push({ title: title, at: isNaN(at) ? 0 : at });
    }
    items.sort(function (a, b) { return b.at - a.at; });
    return items;
  }
  /* One bounded request; the callback runs exactly once with an error or at least one headline. */
  function load(id, done) {
    var feed = source(id), xhr, finished = false, timer;
    function finish(err, items) { if (finished) return; finished = true; clearTimeout(timer); done(err, items); }
    if (!feed || !window.XMLHttpRequest) { done({ message: 'News is unavailable.' }); return; }
    xhr = new window.XMLHttpRequest();
    timer = setTimeout(function () { try { xhr.abort(); } catch (e) { /* already closed */ } finish({ message: 'The news source did not respond.' }); }, TIMEOUT);
    xhr.onreadystatechange = function () {
      var items;
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) { finish({ message: 'Couldn’t load the news.' }); return; }
      items = parse(xhr.responseText);
      if (!items || !items.length) finish({ message: 'Couldn’t load the news.' });
      else finish(null, items);
    };
    try { xhr.open('GET', feed.url, true); xhr.send(); } catch (e) { finish({ message: 'Couldn’t load the news.' }); }
  }
  window.CleanFrameNews = { sources: SOURCES.map(function (s) { return { id: s.id, name: s.name, ar: s.ar, url: s.url }; }), load: load, parse: parse };
}());
