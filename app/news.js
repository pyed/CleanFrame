/* Arabic headlines from public RSS feeds: CleanFrame's only network feature. Text only, no links or images.
   The same file runs as a worker that fetches and reads each feed, so the remote never waits for the network or a parser. */
(function (root) {
  'use strict';
  var TIMEOUT = 12000, LIMIT = 12, SCAN = 40;
  /* Sources marked cors: false send no CORS header: the TV's packaged-app runtime reads them, a desktop browser cannot. */
  var SOURCES = [
    { id: 'sabq', name: 'Sabq', ar: 'سبق', url: 'https://sabq.org/api/rss/articles', cors: false },
    { id: 'alarabiya', name: 'Al Arabiya', ar: 'العربية', url: 'https://www.alarabiya.net/feed/rss2/ar.xml', cors: false },
    { id: 'aljazeera', name: 'Al Jazeera', ar: 'الجزيرة', url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9', cors: false },
    { id: 'sky', name: 'Sky News Arabia', ar: 'سكاي نيوز عربية', url: 'https://www.skynewsarabia.com/rss', cors: true },
    { id: 'aawsat', name: 'Asharq Al-Awsat', ar: 'الشرق الأوسط', url: 'https://aawsat.com/feed', cors: true }
  ];
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' };
  function source(id) { for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i]; return null; }

  /* ---------- Reading a feed: plain string work, the same in the worker and on the page ---------- */
  function character(code) {
    if (code < 0x10000) return String.fromCharCode(code);
    code -= 0x10000;
    return String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
  }
  function entities(text) {
    return text.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]+);/g, function (all, name) {
      var code;
      if (name.charAt(0) !== '#') return NAMED.hasOwnProperty(name) ? NAMED[name] : all;
      code = /^#[xX]/.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code < 0x110000 && (code < 0xD800 || code > 0xDFFF) ? character(code) : all;
    });
  }
  /* An element's XML text: CDATA stays as written, everything else loses one level of escaping. */
  function xmlText(raw) {
    var out = '', pattern = /<!\[CDATA\[([\s\S]*?)\]\]>/g, last = 0, m;
    while ((m = pattern.exec(raw))) { out += entities(raw.slice(last, m.index)) + m[1]; last = pattern.lastIndex; }
    return out + entities(raw.slice(last));
  }
  function child(block, names) {
    var i, m;
    for (i = 0; i < names.length; i++) {
      m = new RegExp('<' + names[i] + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + names[i] + '\\s*>', 'i').exec(block);
      if (m) return xmlText(m[1]);
    }
    return '';
  }
  /* Feeds sometimes nest markup or double-encode entities inside titles; keep plain text only. */
  function plain(text) {
    return entities(String(text).replace(/&amp;/g, '&')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* RSS items or Atom entries, newest first. Reads only the first few dozen; null when it is not a feed. */
  function parse(xml) {
    var text = String(xml), pattern = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi, items = [], scanned = 0, m, title, at;
    if (!/<(?:rss|feed|rdf:RDF)[\s>]/i.test(text)) return null;
    while (scanned < SCAN && (m = pattern.exec(text))) {
      scanned++;
      title = plain(child(m[2], ['title'])).slice(0, 240);
      at = Date.parse(plain(child(m[2], ['pubDate', 'published', 'updated', 'dc:date'])));
      if (title) items.push({ title: title, at: isNaN(at) ? 0 : at });
    }
    items.sort(function (a, b) { return b.at - a.at; });
    return items.slice(0, LIMIT);
  }
  /* One bounded request; done runs exactly once with an error (and the HTTP status) or at least one headline. */
  function fetchFeed(url, done) {
    var xhr, finished = false, timer;
    function finish(err, items) { if (finished) return; finished = true; clearTimeout(timer); done(err, items); }
    if (!root.XMLHttpRequest) { done({ message: 'News is unavailable.', status: 0 }); return; }
    xhr = new root.XMLHttpRequest();
    timer = setTimeout(function () { try { xhr.abort(); } catch (e) { /* already closed */ } finish({ message: 'The news source did not respond.', status: -1 }); }, TIMEOUT);
    xhr.onreadystatechange = function () {
      var items;
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) { finish({ message: 'Couldn’t load the news.', status: xhr.status }); return; }
      items = parse(xhr.responseText);
      if (!items || !items.length) finish({ message: 'Couldn’t load the news.', status: xhr.status });
      else finish(null, items);
    };
    try { xhr.open('GET', url, true); xhr.send(); } catch (e) { finish({ message: 'Couldn’t load the news.', status: 0 }); }
  }

  /* ---------- Worker: fetch and read a known source, reply with the headlines only ---------- */
  if (!root.document) {
    root.onmessage = function (event) {
      var job = event.data || {}, feed = source(job.source);
      if (!feed) { root.postMessage({ id: job.id, error: 'News is unavailable.', status: 0 }); return; }
      fetchFeed(feed.url, function (err, items) {
        root.postMessage(err ? { id: job.id, error: err.message, status: err.status } : { id: job.id, items: items });
      });
    };
    return;
  }

  /* ---------- Page: hand each request to the worker ---------- */
  var script = root.document.currentScript && root.document.currentScript.src, worker = null, workerFailed = !root.Worker || !script;
  var jobs = {}, jobCount = 0, direct = {};
  function stopWorker() {
    var pending = jobs;
    workerFailed = true; jobs = {};
    if (worker) { try { worker.terminate(); } catch (e) { /* already stopped */ } worker = null; }
    Object.keys(pending).forEach(function (id) { pending[id]({ message: 'Couldn’t load the news.', status: 0 }); });
  }
  function startWorker() {
    if (worker || workerFailed) return !!worker;
    try {
      worker = new root.Worker(script);
      worker.onmessage = function (event) {
        var reply = event.data || {}, job = jobs[reply.id];
        if (!job) return;
        delete jobs[reply.id];
        if (reply.error) job({ message: reply.error, status: reply.status }); else job(null, reply.items);
      };
      // A worker that cannot start or fails hands its requests back to the page.
      worker.onerror = function (event) { if (event && event.preventDefault) event.preventDefault(); stopWorker(); };
    } catch (e) { worker = null; workerFailed = true; }
    return !!worker;
  }
  /* Browsers refuse sources without CORS headers; the TV runtime does not. Say so in the browser preview. */
  function explain(feed, err) {
    return err && !err.status && !feed.cors && !root.tizen ? { message: 'Browsers block this source. Open CleanFrame on the TV to read it.' } : err;
  }
  /* The callback runs exactly once with an error or at least one headline. */
  function load(id, done) {
    var feed = source(id), finished = false, job, guard;
    function finish(err, items) { if (finished) return; finished = true; clearTimeout(guard); err = explain(feed, err); done(err ? { message: err.message } : null, items); }
    function directly() { fetchFeed(feed.url, function (err, items) { if (!err) direct[feed.id] = true; finish(err, items); }); }
    if (!feed) { done({ message: 'News is unavailable.' }); return; }
    if (direct[feed.id] || !startWorker()) { directly(); return; }
    job = ++jobCount;
    // A refused request (no HTTP status) may be the worker's own network rules: try once from the page, and stay there.
    jobs[job] = function (err, items) { if (err && !err.status) directly(); else finish(err, items); };
    guard = setTimeout(function () { if (jobs[job]) stopWorker(); }, TIMEOUT + 3000);
    worker.postMessage({ id: job, source: feed.id });
  }
  root.CleanFrameNews = { sources: SOURCES.map(function (s) { return { id: s.id, name: s.name, ar: s.ar, url: s.url }; }), load: load, parse: parse };
}(this));
