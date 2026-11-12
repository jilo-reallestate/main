/** Generated skyline artwork, used until a property has real photos. Deterministic per seed. */
const PAL = [["#0F2027", "#2C5364", "#C9A66B"], ["#E8D8B9", "#C9A66B", "#7A6238"], ["#0B3D2E", "#1F6F54", "#F3DDB0"], ["#232526", "#414345", "#A88B5B"], ["#42275a", "#734b6d", "#F3DDB0"], ["#16222A", "#3A6073", "#C9A66B"]];
export function rnd(seed: number) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

export function skyArt(seed: number, h = 300) {
  const c = PAL[Math.abs(seed) % 6], q = rnd(Math.abs(seed) * 7 + 3), id = `g${Math.abs(seed)}x${h}`;
  let bars = "";
  for (let x = 0; x < 14; x++) {
    const bh = 40 + q() * 120, w = 22 + q() * 28;
    bars += `<rect x="${x * 30 + q() * 8}" y="${200 - bh}" width="${w}" height="${bh}" fill="#fff" opacity="${(0.07 + q() * 0.14).toFixed(2)}" rx="3"/>`;
  }
  return `<svg viewBox="0 0 400 ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".6" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs><rect width="400" height="${h}" fill="url(#${id})"/><circle cx="300" cy="70" r="38" fill="#fff" opacity=".18"/><g transform="translate(0 ${h - 200})">${bars}</g></svg>`;
}

function layer(seed: number, n: number, mn: number, mx: number, by: number, fill: string, op: number, win = false) {
  const q = rnd(seed); let o = "", x = -30;
  for (let i = 0; i < n; i++) {
    const w = 36 + q() * 64, h = mn + q() * (mx - mn);
    o += `<rect x="${x.toFixed(0)}" y="${(by - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${fill}" opacity="${op}"/>`;
    if (win) for (let wy = by - h + 12; wy < by - 10; wy += 15) for (let wx = x + 7; wx < x + w - 8; wx += 12)
      if (q() > 0.74) o += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="7" rx="1" fill="#F3DDB0" opacity="${(0.35 + q() * 0.65).toFixed(2)}"${q() > 0.88 ? ` class="animate-twinkle" style="animation-delay:-${(q() * 3).toFixed(1)}s"` : ""}/>`;
    x += w + q() * 10;
  }
  return o;
}

/** Cinematic Dubai-style skyline at dusk for the home hero. Groups carry data-s for the parallax effect. */
export function heroScene() {
  const q = rnd(11); let stars = "", refl = "";
  for (let i = 0; i < 70; i++) stars += `<circle cx="${(q() * 1600).toFixed(0)}" cy="${(q() * 380).toFixed(0)}" r="${(0.5 + q() * 1.2).toFixed(1)}" fill="#fff" opacity="${(0.2 + q() * 0.6).toFixed(2)}"/>`;
  for (let i = 0; i < 40; i++) refl += `<rect x="${(q() * 1600).toFixed(0)}" y="${(652 + q() * 120).toFixed(0)}" width="2" height="${(10 + q() * 40).toFixed(0)}" fill="#F3DDB0" opacity="${(0.08 + q() * 0.2).toFixed(2)}"/>`;
  return `<svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070a"/><stop offset=".45" stop-color="#1c1630"/><stop offset=".8" stop-color="#8a5a4a"/><stop offset="1" stop-color="#f0b27a"/></linearGradient><radialGradient id="sn" cx=".62" cy="1" r=".6"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".95"/><stop offset=".4" stop-color="#e8955a" stop-opacity=".35"/><stop offset="1" stop-color="#e8955a" stop-opacity="0"/></radialGradient><linearGradient id="wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2430"/><stop offset="1" stop-color="#05070a"/></linearGradient></defs>
<rect width="1600" height="800" fill="url(#sk)"/>${stars}<rect width="1600" height="800" fill="url(#sn)"/>
<g data-s=".012">${layer(3, 30, 60, 190, 660, "#3a2f45", 0.55)}</g>
<g data-s=".026"><path d="M1006 660 L1018 330 L1024 200 L1028 120 L1031 60 L1034 120 L1038 200 L1044 330 L1056 660Z" fill="#171421"/><path d="M990 660 L1004 400 L1016 400 L1022 660Z M1040 660 L1046 400 L1058 400 L1072 660Z" fill="#1d192a"/><circle cx="1031" cy="64" r="3" fill="#F3DDB0" class="animate-twinkle"/>${layer(8, 26, 90, 300, 660, "#171421", 0.95, true)}</g>
<g data-s=".05">${layer(21, 22, 70, 230, 690, "#0a0b10", 1, true)}</g>
<rect y="690" width="1600" height="110" fill="url(#wt)"/><g data-s=".02">${refl}</g></svg>`;
}
