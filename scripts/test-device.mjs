// Test the production adapter with a synthetic API and clock. No TV access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../app/device.js', import.meta.url), 'utf8');
function harness({ video, screen } = {}) {
  let now = 0, next = 0;
  const timers = new Map(), requests = [], launches = [], switches = [];
  const application = {
    getCurrentApplication: () => ({ appInfo: { id: 'Owner12345.Home' }, hide: () => launches.push({ id: 'hide' }) }),
    getAppsInfo: (ok, fail) => requests.push({ ok, fail }),
    launch: (id, ok, fail) => launches.push({ id, ok, fail })
  };
  const window = { tizen: { application } };
  // The TV's video sources and window, when a test supplies them.
  if (video) {
    window.tizen.systeminfo = { getPropertyValue: (name, ok) => { assert.equal(name, 'VIDEOSOURCE'); ok(video); } };
    window.tizen.tvwindow = { setSource: (input, ok, fail) => switches.push({ source: input, ok, fail }), getSource: () => { if (screen instanceof Error) throw screen; return screen; } };
  }
  vm.runInNewContext(source, {
    window, tizen: window.tizen,
    setTimeout: (callback, delay) => { const id = ++next; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  function advance(ms) {
    now += ms;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
  return { device: window.FrameDevice, requests, launches, switches, advance };
}

test('a 500-app catalogue can arrive after the old eight-second deadline', () => {
  const h = harness(), results = [];
  h.device.apps((error, apps) => results.push({ error, apps }));
  assert.equal(h.requests.length, 1);
  h.advance(15000);
  assert.equal(results.length, 0);
  h.requests[0].ok(Array.from({ length: 500 }, (_, i) => ({ id: 'App' + String(i).padStart(7, '0') + '.Consumer', name: 'App ' + i, show: true })));
  assert.equal(results.length, 1);
  assert.equal(results[0].error, null);
  assert.equal(results[0].apps.length, 500);
});

test('catalogue timeout and late callbacks finish only once', () => {
  const h = harness(), results = [];
  h.device.apps((error, apps) => results.push({ error, apps }));
  h.advance(19999);
  assert.equal(results.length, 0);
  h.advance(1);
  assert.equal(results.length, 1);
  assert.match(results[0].error.message, /did not respond/);
  h.requests[0].ok([]);
  h.requests[0].fail({ message: 'Late failure' });
  assert.equal(results.length, 1);
});

test('regional streaming apps stay distinct and system helpers stay hidden', () => {
  const h = harness();
  let apps;
  h.device.apps((error, value) => { assert.equal(error, null); apps = value; });
  h.requests[0].ok([
    { id: 'Owner12345.Home', name: 'My Home', show: true },
    { id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube', show: false },
    { id: 'PvWgqxV3Xa.YouTubeTV', name: 'YouTube TV', show: false },
    { id: 'cj37Ni3qXM.HBONow', name: 'HBO Max', show: false },
    { id: '2022ePop01.SmartTV', name: 'Smart TV', show: true },
    { id: 'd0m1lV1nt2.emanual', name: 'User Guide', show: true },
    { id: 'Hidden1234.Consumer', name: 'Hidden app', show: false }
  ]);
  assert.equal(apps.length, 3);
  assert.equal(apps.find(a => a.name === 'YouTube').brand, 'youtube');
  assert.equal(apps.find(a => a.name === 'YouTube TV').brand, '');
  assert.equal(apps.find(a => a.name === 'HBO Max').brand, 'hbomax');
});

test('launch keeps its eight-second deadline independently of discovery', () => {
  const h = harness(), results = [];
  h.device.launchApp('Synthetic.App', error => results.push(error));
  h.advance(8000);
  assert.equal(results.length, 1);
  assert.match(results[0].message, /did not respond/);
  h.launches[0].ok();
  assert.equal(results.length, 1);
});

test('an HDMI input on standby is selected with the TV’s own source, then the viewer opens', () => {
  const standby = { type: 'HDMI', number: 3 };
  const h = harness({ video: { connected: [{ type: 'TV', number: 1 }], disconnected: [{ type: 'HDMI', number: 1 }, standby] } }), results = [];
  h.device.input(3, error => results.push(error));
  assert.equal(h.switches.length, 1);
  assert.equal(h.switches[0].source, standby);
  h.switches[0].ok();
  assert.equal(h.launches[0].id, 'org.tizen.tv-viewer');
  h.launches[0].ok();
  assert.deepEqual(results, [null]);
});

test('without the viewer, CleanFrame hides to uncover the new input', () => {
  const h = harness({ video: { connected: [{ type: 'HDMI', number: 3 }], disconnected: [] } }), results = [];
  h.device.input(3, error => results.push(error));
  h.switches[0].ok();
  h.launches[0].fail({ name: 'NotFoundError', message: 'No viewer' });
  assert.deepEqual(h.launches.map(l => l.id), ['org.tizen.tv-viewer', 'hide']);
  assert.deepEqual(results, [null]);
});

test('an input the TV does not list fails without switching', () => {
  const h = harness({ video: { connected: [{ type: 'HDMI', number: 1 }], disconnected: [] } }), results = [];
  h.device.input(3, error => results.push(error));
  assert.equal(h.switches.length, 0);
  assert.equal(results.length, 1);
  assert.match(results[0].message, /does not list this HDMI input/);
});

test('a source change that never answers finishes once at the deadline', () => {
  const h = harness({ video: { connected: [{ type: 'HDMI', number: 3 }], disconnected: [] } }), results = [];
  h.device.input(3, error => results.push(error));
  h.advance(8000);
  assert.equal(results.length, 1);
  assert.match(results[0].message, /did not respond/);
  h.switches[0].ok();
  assert.equal(results.length, 1);
  assert.equal(h.launches.length, 0);
});

test('inputs report connected and listed HDMI numbers only', () => {
  const h = harness({ video: { connected: [{ type: 'TV', number: 1 }, { type: 'HDMI', number: 2 }], disconnected: [{ type: 'HDMI', number: 3 }, { type: 'AV', number: 1 }] } });
  let ports;
  h.device.inputs((error, value) => { assert.equal(error, null); ports = value; });
  assert.deepEqual(JSON.parse(JSON.stringify(ports)), { connected: [2], listed: [2, 3] });
});

test('without the TV window API, an input asks for the TV', () => {
  const h = harness(), results = [];
  h.device.input(3, error => results.push(error));
  assert.match(results[0].message, /Open CleanFrame on the TV/);
  h.device.inputs(error => results.push(error));
  assert.match(results[1].message, /Open CleanFrame on the TV/);
});

test('the current input is the HDMI port on screen, or 0', () => {
  const video = { connected: [], disconnected: [] };
  assert.equal(harness({ video, screen: { type: 'HDMI', number: 3 } }).device.currentInput(), 3);
  assert.equal(harness({ video, screen: { type: 'TV', number: 1 } }).device.currentInput(), 0);
  assert.equal(harness({ video, screen: new Error('No window') }).device.currentInput(), 0);
  assert.equal(harness().device.currentInput(), 0);
});
