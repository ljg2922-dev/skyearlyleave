/* 인천하늘초 조퇴증 — 공통 스크립트 */

/** 서버(Apps Script) 함수 호출 */
async function run(fn, ...args) {
  const url = (window.CONFIG || {}).API_URL || '';
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url))
    throw new Error('관리자 설정이 필요합니다. (config.js 의 API_URL)');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn, args })
    });
  } catch (e) {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요.');
  }
  let j;
  try { j = await res.json(); }
  catch (e) { throw new Error('서버 응답을 읽지 못했어요. (Apps Script 배포 설정을 확인하세요)'); }
  if (!j.ok) throw new Error(j.error || '알 수 없는 오류');
  return j.data;
}

/** 학생 조퇴증 주소 (이 사이트의 pass.html) */
function passUrl(id) {
  return new URL('pass.html?t=' + encodeURIComponent(id), location.href).href;
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const $ = s => document.querySelector(s);
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function who(s) {
  return esc(`${s.grade}학년 ${s.cls}반 ${s.num ? s.num + '번 ' : ''}${s.name}`);
}
function stCls(st) { return st === '외출확인' ? 'out' : st === '취소' ? 'cancel' : 'issued'; }
function chip(st) {
  const label = st === '외출확인' ? '교문 통과' : st === '취소' ? '취소됨' : '대기';
  return `<span class="chip c-${stCls(st)}">${label}</span>`;
}
function hm(dt) { return dt ? String(dt).slice(11, 16) : ''; }
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function dateKo(ymd, withYear) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y) return '';
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${withYear ? y + '년 ' : ''}${m}월 ${d}일 (${w})`;
}
function makeQR(el, text, size) {
  el.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    el.innerHTML = `<p style="width:${size}px;margin:0;color:var(--muted);font-size:13px;line-height:1.6">QR 코드를 불러오지 못했어요.<br>아래 링크를 복사해 보내 주세요.</p>`;
    return;
  }
  new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
}
let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}
function copyText(input) {
  const v = input.value;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(v).then(() => toast('링크를 복사했어요.'), fallback);
  } else fallback();
  function fallback() { input.select(); try { document.execCommand('copy'); toast('링크를 복사했어요.'); } catch (e) { toast('직접 선택해서 복사하세요.'); } }
}

/* ───────── 조퇴증 이미지 만들기 ───────── */
const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

function slipFileName(s) {
  return `조퇴증_${s.grade}-${s.cls}_${s.name}_${String(s.date || s.issuedAt || '').slice(0, 10)}.png`;
}

async function drawSlip(s) {
  try { await Promise.all(['500', '600', '700', '800'].map(w => document.fonts.load(`${w} 40px Pretendard`))); } catch (e) {}

  const W = 1080, M = 56, CW = W - M * 2, PAD = 64, HEAD = 330;
  const date = s.date || String(s.issuedAt || '').slice(0, 10);
  const rows = [
    [{ k: '조퇴 날짜', v: dateKo(date) }, { k: '조퇴 시각', v: s.time, big: true }],
    [{ k: '하교 방법', v: s.method }]
  ];
  if (s.handler) rows.push([{ k: '보호자', v: s.handler }]);
  rows.push([{ k: '발급 교사', v: s.teacher }, { k: '발급 시각', v: hm(s.issuedAt) }]);
  const ROW = 132, gridH = rows.length * ROW;
  const H = M + HEAD + 300 + 40 + gridH + 48 + 112 + 150 + M;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const rr = (X, Y, w, h, r) => {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  };
  const text = (t, X, Y, size, weight, color, align, maxW) => {
    let sz = size;
    x.font = `${weight} ${sz}px ${FONT}`;
    while (maxW && x.measureText(t).width > maxW && sz > 18) { sz -= 2; x.font = `${weight} ${sz}px ${FONT}`; }
    x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'alphabetic';
    x.fillText(t, X, Y);
  };
  const BG = '#eaf2fd';

  // 배경 + 카드
  x.fillStyle = BG; x.fillRect(0, 0, W, H);
  x.save();
  x.shadowColor = 'rgba(23,90,180,.20)'; x.shadowBlur = 60; x.shadowOffsetY = 22;
  rr(M, M, CW, H - M * 2, 48); x.fillStyle = '#fff'; x.fill();
  x.restore();
  x.save(); rr(M, M, CW, H - M * 2, 48); x.clip();

  // 머리
  const g = x.createLinearGradient(M, M, M + CW, M + HEAD);
  g.addColorStop(0, '#4aa3ff'); g.addColorStop(.5, '#1f7aec'); g.addColorStop(1, '#1457b5');
  x.fillStyle = g; x.fillRect(M, M, CW, HEAD);
  x.fillStyle = 'rgba(255,255,255,.10)'; x.beginPath(); x.arc(M + CW - 30, M - 10, 190, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.arc(M + CW - 300, M + HEAD - 30, 100, 0, Math.PI * 2); x.fill();
  text('인천하늘초등학교', M + PAD, M + 92, 34, 700, 'rgba(255,255,255,.95)');
  try { x.letterSpacing = '6px'; } catch (e) {}
  text('EARLY DISMISSAL PASS', M + PAD, M + 146, 22, 700, 'rgba(255,255,255,.7)');
  try { x.letterSpacing = '14px'; } catch (e) {}
  text('조퇴증', M + PAD, M + 262, 104, 800, '#fff');
  try { x.letterSpacing = '0px'; } catch (e) {}

  // 학생
  let y = M + HEAD + 84;
  const cls = `${s.grade}학년 ${s.cls}반${s.num ? ' ' + s.num + '번' : ''}`;
  x.font = `700 32px ${FONT}`;
  const pw = x.measureText(cls).width + 56;
  rr(W / 2 - pw / 2, y - 44, pw, 62, 31); x.fillStyle = '#eff6ff'; x.fill();
  text(cls, W / 2, y, 32, 700, '#1665cc', 'center');
  text(s.name, W / 2, y + 160, 120, 800, '#0f1b2d', 'center', CW - PAD * 2);

  // 절취선
  y = M + HEAD + 300;
  x.strokeStyle = '#e1e6ec'; x.lineWidth = 4; x.setLineDash([14, 12]);
  x.beginPath(); x.moveTo(M + 50, y); x.lineTo(M + CW - 50, y); x.stroke(); x.setLineDash([]);
  x.fillStyle = BG;
  x.beginPath(); x.arc(M, y, 26, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(M + CW, y, 26, 0, Math.PI * 2); x.fill();

  // 정보 표
  y += 40;
  const GX = M + PAD - 16, GW = CW - (PAD - 16) * 2;
  rr(GX, y, GW, gridH, 28); x.fillStyle = '#f7f9fb'; x.fill();
  rows.forEach((row, i) => {
    const ry = y + i * ROW;
    if (i) { x.fillStyle = '#e8ecf1'; x.fillRect(GX + 28, ry, GW - 56, 2); }
    const cw = GW / row.length;
    row.forEach((cell, j) => {
      const cx = GX + cw * j + 32;
      if (j) { x.fillStyle = '#e8ecf1'; x.fillRect(GX + cw * j, ry + 26, 2, ROW - 52); }
      text(cell.k, cx, ry + 50, 25, 600, '#8a94a3');
      text(cell.v || '-', cx, ry + (cell.big ? 106 : 100), cell.big ? 50 : 36, cell.big ? 800 : 700, '#0f1b2d', 'left', cw - 64);
    });
  });

  // 상태 띠
  y += gridH + 48;
  let band = ['#fff6e6', '#b45f00', '발급 당일에만 유효합니다'];
  if (s.status === '취소') band = ['#fdeeee', '#e03e3e', '취소된 조퇴증입니다 (사용 불가)'];
  else if (s.status === '외출확인') band = ['#e8f8f1', '#0e9f6e', `✓ ${hm(s.checkedAt)} 교문 통과 확인`];
  rr(GX, y, GW, 88, 24); x.fillStyle = band[0]; x.fill();
  text(band[2], W / 2, y + 57, 32, 700, band[1], 'center');

  // 바닥글
  y += 88 + 74;
  text('교문에서 배움터 지킴이 선생님께 보여 주세요', W / 2, y, 28, 600, '#3a4656', 'center');
  text('No. ' + String(s.id || '').slice(0, 8).toUpperCase(), W / 2, y + 48, 22, 500, '#a3acb9', 'center');
  x.restore();
  return c;
}

function saveCanvas(c, name) {
  return new Promise(res => c.toBlob(b => {
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    res();
  }, 'image/png'));
}
