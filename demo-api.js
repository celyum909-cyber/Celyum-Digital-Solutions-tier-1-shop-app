// Demo stand-in for the shop's Cloudflare Worker.
// Used only by demo-shop.html and demo-owner.html. It answers the same requests the real Worker does,
// keeps everything in this browser (localStorage), and tells the other page when something changes.
// Nothing here talks to the real Worker or to Stripe.
(function () {
  'use strict';
  const BASE = 'https://demo.invalid';
  const CFG = {"store": {"name": "Your Shop", "tagline": "Local goods, made for regulars", "initials": "YS", "logo": "", "brandColor": "#072448", "colors": {"brand": "#072448", "accent": "#ff6150", "member": "#4ed4d2", "reward": "#ffcb00", "highlight": "#f8a94b"}, "address": "123 Main Street, Your City, ST 00000", "hours": "Mon\u2013Sat 10am\u20138pm \u00b7 Sun 12\u20136pm", "phone": "(555) 555-0100", "email": "hello@yourshop.com", "shareUrl": ""}, "products": [{"id": "tee-logo", "name": "Classic Logo Tee", "category": "Tees", "price": 24.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/tee-logo.jpg", "art": "tee", "color": "#1d1d1d", "desc": "Soft black cotton tee with our embroidered crest on the chest."}, {"id": "tee-cream", "name": "Black Pocket Tee", "category": "Tees", "price": 22.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/tee-cream.jpg", "art": "tee", "color": "#1d1d1d", "desc": "Relaxed fit with a chest pocket and a small stitched mountain."}, {"id": "tee-night", "name": "Night Shift Tee", "category": "Tees", "price": 26.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/tee-night.jpg", "art": "tee", "color": "#2b2f3a", "desc": "Heavyweight black tee with a big neon Night Shift print."}, {"id": "hoodie-forest", "name": "Forest Hoodie", "category": "Hoodies", "price": 54.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/hoodie-forest.jpg", "art": "hoodie", "color": "#2f6f4f", "desc": "Brushed fleece pullover with kangaroo pocket and embroidered logo."}, {"id": "hoodie-sand", "name": "Sand Zip Hoodie", "category": "Hoodies", "price": 59.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/hoodie-sand.jpg", "art": "hoodie", "color": "#c9b48f", "desc": "Soft sherpa fleece full-zip with zip pockets."}, {"id": "hoodie-plum", "name": "Plum Hoodie", "category": "Hoodies", "price": 52.99, "sizes": ["S", "M", "L", "XL", "2XL"], "image": "images/hoodie-plum.jpg", "art": "hoodie", "color": "#5b3a63", "desc": "Our customer-favorite color, back again with the Classic crest."}, {"id": "cap-logo", "name": "Logo Dad Cap", "category": "Hats", "price": 27.99, "sizes": ["One size"], "image": "images/cap-logo.jpg", "art": "cap", "color": "#cbbd9c", "desc": "Washed khaki cotton cap with embroidered logo and adjustable strap."}, {"id": "cap-black", "name": "Black Snapback", "category": "Hats", "price": 29.99, "sizes": ["One size"], "image": "images/cap-black.jpg", "art": "cap", "color": "#23262d", "desc": "Structured black snapback with embroidered monogram."}, {"id": "tote", "name": "Canvas Tote", "category": "Extras", "price": 18.99, "sizes": ["One size"], "image": "images/tote.jpg", "art": "tote", "color": "#d9cbb0", "desc": "Sturdy natural canvas tote for everyday carry."}, {"id": "mug", "name": "Shop Mug", "category": "Extras", "price": 14.99, "sizes": ["One size"], "image": "images/mug.jpg", "art": "mug", "color": "#f2efe8", "memberPrice": 11.99, "desc": "12 oz ceramic mug. Dishwasher safe."}, {"id": "stickers", "name": "Sticker Pack", "category": "Extras", "price": 6.99, "sizes": ["One size"], "image": "images/stickers.jpg", "art": "sticker", "color": "#e8b04b", "desc": "Six weatherproof vinyl stickers."}], "members": {"enabled": true, "percentOff": 10, "perks": ["Member prices on everything", "Members-only weekly drops", "Rewards punches on every order"]}, "shipping": {"enabled": true, "flat": 5.99}, "demo": {"drop": {"id": "hoodie-plum", "price": 39.99, "title": "The Plum Hoodie is back", "note": "Limited run. When it's gone, it's gone.", "ends": "2099-12-31", "membersOnly": false}, "sales": {"tee-night": 19.99, "tote": 14.99}}, "rewards": {"enabled": true, "punchValue": 20, "punches": 10, "reward": "free cap"}};
  const KEY = 'shopdemo:v1';
  const byId = Object.fromEntries(CFG.products.map(p => [p.id, p]));
  const round2 = n => Math.round(n * 100) / 100;
  const ymd = ms => new Date(ms).toISOString().slice(0, 10);

  // ---------- sample data ----------
  function seed() {
    let s = 20261020; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const now = Date.now(), day = 86400000;
    const names = [['Jordan', 'Lee'], ['Priya', 'Shah'], ['Marcus', 'Bell'], ['Ana', 'Ruiz'], ['Tom', 'Okafor'], ['Grace', 'Kim'], ['Sam', 'Novak'], ['Lena', 'Fischer']];
    const members = {};
    names.forEach(([f, l], i) => {
      const email = `${f}.${l}`.toLowerCase() + '@example.com';
      members[email] = { name: f, email, phone: `(555) 555-01${String(10 + i)}`, since: now - Math.floor(rnd() * 40) * day - i * 3600e3 };
    });
    const emails = Object.keys(members), orders = [], started = {};
    const weights = { 'hoodie-forest': 5, 'tee-logo': 6, 'cap-black': 4, 'mug': 4, 'tee-night': 3, 'hoodie-plum': 3, 'stickers': 4, 'tote': 3 };
    const pool = CFG.products.flatMap(p => Array(weights[p.id] || 2).fill(p));
    for (let d = 34; d >= 0; d--) {
      const dow = new Date(now - d * day).getDay(), busy = dow === 6 ? 2.2 : dow === 5 || dow === 0 ? 1.6 : 1;
      const n = Math.round((0.8 + rnd() * 1.6) * busy);
      started[ymd(now - d * day)] = Math.round(n * (1.25 + rnd() * 0.3));
      for (let k = 0; k < n; k++) {
        const created = now - d * day - Math.floor(rnd() * 9 + 1) * 3600e3;
        if (created > now) continue;
        const member = rnd() < 0.4, lines = [], count = rnd() < 0.7 ? 1 : 2;
        for (let j = 0; j < count; j++) {
          const p = pool[Math.floor(rnd() * pool.length)], qty = rnd() < 0.85 ? 1 : 2;
          let price = p.price; if (member) price = p.memberPrice || round2(p.price * (1 - (CFG.members?.percentOff || 0) / 100));
          lines.push({ name: p.name, qty, amount: round2(price * qty) });
        }
        const ship = rnd() < 0.3, sub = lines.reduce((a, l) => a + l.amount, 0);
        orders.push({ id: 'demo_' + created.toString(36), created, lines, fulfilment: ship ? 'ship' : 'pickup', member: member ? emails[Math.floor(rnd() * emails.length)] : '', total: round2(sub + (ship ? Number(CFG.shipping?.flat || 0) : 0)) });
      }
    }
    const ends = ymd(now + 5 * day);
    const drop = CFG.demo?.drop ? { ...CFG.demo.drop, ends } : null;
    return { settings: { drop, sales: { ...(CFG.demo?.sales || {}) }, memberPercent: CFG.members?.percentOff ?? 0, photos: {}, updated: now },
      photoData: {}, members, orders, started, since: now - 40 * day };
  }

  let db;
  function read() { try { db = JSON.parse(localStorage.getItem(KEY)) } catch { db = null } if (!db || !db.settings) { db = seed(); write() } return db }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(db)); return true } catch { return false } }
  read();

  // ---------- telling the other page ----------
  const listeners = [];
  let bc = null; try { bc = new BroadcastChannel('shopdemo') } catch {}
  function changed(type, detail) {
    write();
    const msg = { type, detail, at: Date.now() };
    if (bc) bc.postMessage(msg);
    try { localStorage.setItem(KEY + ':ping', JSON.stringify(msg)) } catch {}
  }
  function heard(msg) { read(); listeners.forEach(fn => { try { fn(msg.type, msg.detail) } catch (e) { console.error(e) } }) }
  if (bc) bc.onmessage = e => heard(e.data);
  else window.addEventListener('storage', e => { if (e.key === KEY + ':ping' && e.newValue) heard(JSON.parse(e.newValue)) });

  // ---------- the same rules as the real Worker ----------
  function priceOf(p, settings, isMember) {
    let price = p.price, why = '';
    const sale = Number(settings.sales?.[p.id]);
    if (sale > 0 && sale < price) { price = sale; why = 'sale' }
    const d = settings.drop;
    const dropLive = d && d.id === p.id && d.price > 0 && (!d.ends || Date.now() <= new Date(d.ends + 'T23:59:59').getTime() + 14 * 3600e3);
    if (dropLive && (!d.membersOnly || isMember) && d.price < price) { price = d.price; why = 'drop' }
    if (isMember && CFG.members?.enabled) {
      const pct = settings.memberPercent ?? CFG.members?.percentOff ?? 0;
      const mp = p.memberPrice > 0 ? p.memberPrice : pct > 0 ? round2(p.price * (1 - pct / 100)) : Infinity;
      if (mp < price) { price = mp; why = 'member' }
    }
    return { price: round2(price), why };
  }
  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  function stats(url) {
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    const tz = Math.max(-840, Math.min(840, Number(url.searchParams.get('tz')) || 0));
    const dayOf = ms => new Date(ms - tz * 60000).toISOString().slice(0, 10);
    const now = Date.now(), todayStart = Date.parse(dayOf(now) + 'T00:00:00Z') + tz * 60000, since = todayStart - (days - 1) * 86400000;
    const byDay = {}; for (let t = since; t <= now; t += 86400000) byDay[dayOf(t)] = { date: dayOf(t), revenue: 0, orders: 0 };
    const products = {}; let revenue = 0, items = 0, pickup = 0, ship = 0, memberOrders = 0;
    const list = db.orders.filter(o => o.created >= since && o.created <= now);
    for (const o of list) {
      revenue += o.total; const d = byDay[dayOf(o.created)]; if (d) { d.revenue += o.total; d.orders++ }
      if (o.fulfilment === 'ship') ship++; else pickup++;
      if (o.member) memberOrders++;
      for (const l of o.lines) { const p = products[l.name] ||= { name: l.name, units: 0, revenue: 0 }; p.units += l.qty; p.revenue += l.amount; items += l.qty }
    }
    const started = Object.keys(byDay).reduce((a, k) => a + (db.started[k] || 0), 0);
    const newMembers = Object.values(db.members).filter(m => m.since >= since).length;
    return { days, currency: 'usd', testMode: false, truncated: false, revenue: round2(revenue), orders: list.length, items,
      avgOrder: list.length ? round2(revenue / list.length) : 0, pickup, ship, memberOrders, started: Math.max(started, list.length), finished: list.length, newMembers,
      byDay: Object.values(byDay).map(d => ({ ...d, revenue: round2(d.revenue) })),
      top: Object.values(products).map(p => ({ ...p, revenue: round2(p.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8) };
  }

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const dataUrl = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(blob) });

  async function handle(url, init) {
    read();
    const path = url.pathname.replace(/\/+$/, '') || '/', method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {}), admin = !!headers.get('X-Admin-Password');
    const body = () => { try { return JSON.parse(init.body || '{}') } catch { return {} } };
    await wait(120 + Math.random() * 180);

    if (method === 'GET' && path === '/store') {
      return json({ ...db.settings, store: { name: CFG.store?.name, brandColor: CFG.store?.brandColor }, products: CFG.products.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price })) });
    }
    if (method === 'POST' && path === '/join') {
      const b = body(), name = clean(b.name, 40), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 30);
      if (!name) return json({ error: 'Please add your first name' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Please check your email address' }, 400);
      db.members[email] = { name, email, phone, since: db.members[email]?.since || Date.now() };
      changed('member', { name }); return json({ ok: true });
    }
    if (method === 'POST' && path === '/checkout') {
      const b = body(), isMember = !!(CFG.members?.enabled && b.memberEmail && db.members[String(b.memberEmail).toLowerCase()]);
      const lines = [];
      for (const it of (Array.isArray(b.items) ? b.items : [])) {
        const p = byId[it.id], qty = Math.floor(Number(it.qty)); if (!p || !(qty >= 1 && qty <= 20)) continue;
        lines.push({ name: p.name, qty, amount: round2(priceOf(p, db.settings, isMember).price * qty) });
      }
      if (!lines.length) return json({ error: 'Your cart is empty' }, 400);
      const ship = b.fulfilment === 'ship' && CFG.shipping?.enabled, now = Date.now();
      const id = 'demo_cs_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
      const total = round2(lines.reduce((a, l) => a + l.amount, 0) + (ship ? Number(CFG.shipping.flat || 0) : 0));
      db.orders.push({ id, created: now, lines, fulfilment: ship ? 'ship' : 'pickup', member: isMember ? String(b.memberEmail).toLowerCase() : '', total });
      db.started[ymd(now)] = (db.started[ymd(now)] || 0) + 1;
      changed('order', { total, fulfilment: ship ? 'ship' : 'pickup', items: lines.reduce((a, l) => a + l.qty, 0), first: lines[0].name });
      const back = typeof b.returnUrl === 'string' ? b.returnUrl : location.href.split(/[?#]/)[0];
      await wait(500);
      return json({ url: `${back}?checkout=success&order=${id}` });
    }
    // Owner side: any password works in the demo.
    if (path === '/login' || path.startsWith('/admin/')) {
      if (!admin) return json({ error: 'Wrong password' }, 401);
      if (path === '/login') return json({ ok: true });
      if (method === 'GET' && path === '/admin/stats') return json(stats(url));
      if (method === 'GET' && path === '/admin/members') {
        const members = Object.values(db.members).sort((a, b) => (b.since || 0) - (a.since || 0));
        return json({ count: members.length, members });
      }
      if (method === 'POST' && path === '/admin/member/remove') {
        const email = clean(body().email, 120).toLowerCase(); delete db.members[email]; changed('member', {}); return json({ ok: true });
      }
      if (method === 'POST' && path === '/admin/settings') {
        const b = body(), next = { ...db.settings };
        if ('drop' in b) {
          if (!b.drop) next.drop = null;
          else {
            const d = b.drop, p = byId[d.id], price = Number(d.price);
            if (!p) return json({ error: 'Pick a product for the drop' }, 400);
            if (!(price > 0 && price < p.price)) return json({ error: `Drop price must be below the regular price (${p.price})` }, 400);
            next.drop = { id: p.id, price: round2(price), title: clean(d.title, 80), note: clean(d.note, 160), ends: d.ends || '', membersOnly: !!d.membersOnly };
          }
        }
        if ('sales' in b) {
          const sales = {};
          for (const [id, v] of Object.entries(b.sales || {})) {
            const p = byId[id], price = Number(v); if (!p || !(price > 0)) continue;
            if (price >= p.price) return json({ error: `${p.name}: sale price must be below ${p.price}` }, 400);
            sales[id] = round2(price);
          }
          next.sales = sales;
        }
        if ('memberPercent' in b) {
          const pct = Number(b.memberPercent);
          if (!(pct >= 0 && pct <= 50)) return json({ error: 'Member discount must be between 0 and 50%' }, 400);
          next.memberPercent = Math.round(pct);
        }
        next.updated = Date.now(); db.settings = next; changed('settings', {});
        return json({ ok: true, settings: next });
      }
      if (method === 'POST' && path === '/admin/photo') {
        const form = init.body, id = String(form.get('id') || '');
        if (!byId[id]) return json({ error: 'Unknown product' }, 400);
        const photos = { ...(db.settings.photos || {}) };
        if (form.get('remove') === '1') { delete db.photoData[id]; delete photos[id] }
        else {
          const file = form.get('image'); if (!file || !file.size) return json({ error: 'No photo was sent' }, 400);
          db.photoData[id] = await dataUrl(file); photos[id] = Date.now();
        }
        db.settings = { ...db.settings, photos, updated: Date.now() };
        if (!write()) { delete db.photoData[id]; delete db.settings.photos[id]; return json({ error: 'The demo has run out of room for photos. Remove one or reset the demo.' }, 400) }
        changed('settings', {}); return json({ ok: true, photos });
      }
    }
    return json({ error: 'Not found' }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const u = typeof input === 'string' ? input : input && input.url;
    if (u && u.startsWith(BASE)) return handle(new URL(u), init || {});
    return realFetch(input, init);
  };

  window.DEMO = {
    base: BASE,
    photo: id => (read(), db.photoData[id] || ''),
    on: fn => listeners.push(fn),
  };
})();
