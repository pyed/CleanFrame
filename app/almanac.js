/* Offline Hijri dates and prayer times. Solar formulas run locally: no location service or network. */
(function () {
  'use strict';
  var DAY = 86400000, HOUR = 3600000, HIJRI = window.CleanFrameHijri || null;

  /* Official twilight angles in degrees, or Isha minutes after Maghrib. Asr uses the standard shadow factor.
     Umm al-Qura's Fajr offset calibrates these solar formulas to ummulqura.org.sa (October 2026 samples). */
  var METHODS = {
    ummalqura: { fajr: 18.5, fajrMinutes: 0.45, ishaMinutes: 90, ramadanIshaMinutes: 120 },
    uae: { fajr: 18.2, isha: 18.2 },
    qatar: { fajr: 18, ishaMinutes: 90 },
    kuwait: { fajr: 18, isha: 17.5 }
  };
  /* Fixed UTC offsets: none of these regions observes daylight saving time. */
  var CITIES = [
    { id: 'riyadh', name: 'Riyadh', ar: 'الرياض', lat: 24.7136, lng: 46.6753, tz: 3, method: 'ummalqura' },
    { id: 'jeddah', name: 'Jeddah', ar: 'جدة', lat: 21.5433, lng: 39.1728, tz: 3, method: 'ummalqura' },
    { id: 'makkah', name: 'Makkah', ar: 'مكة المكرمة', lat: 21.4225, lng: 39.8262, tz: 3, method: 'ummalqura' },
    { id: 'madinah', name: 'Madinah', ar: 'المدينة المنورة', lat: 24.4672, lng: 39.6111, tz: 3, method: 'ummalqura' },
    { id: 'dammam', name: 'Dammam', ar: 'الدمام', lat: 26.4207, lng: 50.0888, tz: 3, method: 'ummalqura' },
    { id: 'taif', name: 'Taif', ar: 'الطائف', lat: 21.2703, lng: 40.4158, tz: 3, method: 'ummalqura' },
    { id: 'abha', name: 'Abha', ar: 'أبها', lat: 18.2164, lng: 42.5053, tz: 3, method: 'ummalqura' },
    { id: 'tabuk', name: 'Tabuk', ar: 'تبوك', lat: 28.3838, lng: 36.555, tz: 3, method: 'ummalqura' },
    { id: 'dubai', name: 'Dubai', ar: 'دبي', lat: 25.2048, lng: 55.2708, tz: 4, method: 'uae' },
    { id: 'abudhabi', name: 'Abu Dhabi', ar: 'أبوظبي', lat: 24.4539, lng: 54.3773, tz: 4, method: 'uae' },
    { id: 'doha', name: 'Doha', ar: 'الدوحة', lat: 25.2854, lng: 51.531, tz: 3, method: 'qatar' },
    { id: 'kuwait', name: 'Kuwait City', ar: 'الكويت', lat: 29.3759, lng: 47.9774, tz: 3, method: 'kuwait' }
  ];
  var PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function sin(d) { return Math.sin(rad(d)); }
  function cos(d) { return Math.cos(rad(d)); }
  function tan(d) { return Math.tan(rad(d)); }
  function wrap(value, range) { value -= range * Math.floor(value / range); return value < 0 ? value + range : value; }
  function city(id) { for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i]; return CITIES[0]; }
  function julian(year, month, day) {
    if (month <= 2) { year -= 1; month += 12; }
    var a = Math.floor(year / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
  }
  /* Low-precision solar coordinates (US Naval Observatory); within a minute for prayer times. */
  function sun(jd) {
    var d = jd - 2451545, g = wrap(357.529 + 0.98560028 * d, 360), q = wrap(280.459 + 0.98564736 * d, 360);
    var l = wrap(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360), e = 23.439 - 0.00000036 * d;
    var ra = wrap(deg(Math.atan2(cos(e) * sin(l), cos(l))) / 15, 24);
    return { declination: deg(Math.asin(sin(e) * sin(l))), equation: q / 15 - ra };
  }
  /* Local clock hours for one civil day, from a first estimate of each event. */
  function hours(year, month, day, place, ramadan) {
    var method = METHODS[place.method], jd = julian(year, month, day) - place.lng / (15 * 24), h, shift = place.tz - place.lng / 15;
    function noon(t) { return wrap(12 - sun(jd + t).equation, 24); }
    function angle(a, t, before) {
      var s = sun(jd + t), arc = deg(Math.acos((-sin(a) - sin(s.declination) * sin(place.lat)) / (cos(s.declination) * cos(place.lat)))) / 15;
      return noon(t) + (before ? -arc : arc);
    }
    function asr(t) { var s = sun(jd + t); return angle(-deg(Math.atan(1 / (1 + tan(Math.abs(place.lat - s.declination))))), t); }
    h = { fajr: angle(method.fajr, 5 / 24, true), dhuhr: noon(12 / 24), asr: asr(13 / 24), maghrib: angle(0.833, 18 / 24), isha: method.isha ? angle(method.isha, 18 / 24) : 0 };
    PRAYERS.forEach(function (id) { h[id] += shift; });
    h.fajr += (method.fajrMinutes || 0) / 60;
    if (!method.isha) h.isha = h.maghrib + (ramadan && method.ramadanIshaMinutes || method.ishaMinutes) / 60;
    return h;
  }
  function schedule(year, month, day, place) {
    var h = hours(year, month, day, place, hijri(year, month, day).month === 9), base = Date.UTC(year, month - 1, day);
    return PRAYERS.map(function (id) {
      // Published Umm al-Qura times round up to the next whole minute.
      var minutes = Math.ceil(h[id] * 60 - 1e-6);
      return { id: id, at: base + minutes * 60000 - place.tz * HOUR, hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 };
    });
  }
  /* Today's five prayers in the city's own time, and the next one after now (tomorrow's Fajr after Isha). */
  function prayers(now, id) {
    var place = city(id), local = new Date(now + place.tz * HOUR), y = local.getUTCFullYear(), m = local.getUTCMonth() + 1, d = local.getUTCDate();
    var list = schedule(y, m, d, place), next = null, i, tomorrow;
    for (i = 0; i < list.length && !next; i++) if (list[i].at > now) next = list[i];
    if (!next) { tomorrow = new Date(Date.UTC(y, m - 1, d + 1)); next = schedule(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), place)[0]; }
    return { city: place.id, list: list, next: next, friday: local.getUTCDay() === 5 };
  }

  /* Umm al-Qura dates from the generated table; the arithmetic calendar outside it may differ by a day. */
  function hijri(year, month, day) {
    var n = Math.floor(Date.UTC(year, month - 1, day) / DAY), start, i, length;
    if (HIJRI && n >= HIJRI.epochDay) {
      start = HIJRI.epochDay;
      for (i = 0; i < HIJRI.months.length; i++) {
        length = HIJRI.months.charAt(i) === '1' ? 30 : 29;
        if (n < start + length) return { year: HIJRI.firstYear + Math.floor(i / 12), month: i % 12 + 1, day: n - start + 1, table: true };
        start += length;
      }
    }
    return tabular(n);
  }
  function tabularStart(year, month) { return Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + 1948439.5; }
  function tabular(n) {
    var jd = n + 2440587.5, year = Math.floor((30 * (jd - 1948439.5) + 10646) / 10631);
    var month = Math.min(12, Math.ceil((jd - (29 + tabularStart(year, 1))) / 29.5) + 1);
    return { year: year, month: month, day: Math.round(jd - tabularStart(year, month)) + 1, table: false };
  }

  window.CleanFrameAlmanac = {
    cities: CITIES.map(function (c) { return { id: c.id, name: c.name, ar: c.ar }; }),
    hijri: hijri,
    prayers: prayers
  };
}());
