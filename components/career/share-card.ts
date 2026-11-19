// "Share my career": draws the player's career onto an image they can post anywhere.
import {TIERS, legacy, overall, type Career} from '../../lib/career/engine';

const fit = (ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) => {
  let s = size; do { ctx.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`; s -= 2; } while (ctx.measureText(text).width > max && s > 24);
};
const img = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function careerCard(c: Career): Promise<Blob | null> {
  const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#191126'); bg.addColorStop(.6, '#0b0b12'); bg.addColorStop(1, '#14220c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c6f04d'; ctx.fillRect(0, 0, 14, H);
  const belts = c.divisionTitles?.length ?? 0, holdingTwo = !!c.dual;
  const model = c.look?.model ?? 'kalani';
  const art = await img(`/fighters/${model}${holdingTwo ? '-double' : c.champ ? '-champ' : '-stance'}.webp`);
  if (art) { const h = H * 1.42, w = h * art.width / art.height; ctx.drawImage(art, W - w + 70, -H * .13, w, h); }
  const fade = ctx.createLinearGradient(560, 0, 900, 0); fade.addColorStop(0, '#0d0c14'); fade.addColorStop(1, '#0d0c1400'); ctx.fillStyle = fade; ctx.fillRect(0, 0, 900, H);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#c6f04d'; ctx.font = '900 34px system-ui, sans-serif'; ctx.fillText('VERSUS', 64, 78);
  ctx.fillStyle = '#ffffff'; fit(ctx, c.name.toUpperCase(), 900, 84, 690); ctx.fillText(c.name.toUpperCase(), 64, 186);
  ctx.fillStyle = '#e9c873'; ctx.font = '800 30px system-ui, sans-serif';
  const title = holdingTwo ? 'DOUBLE CHAMPION' : belts >= 2 ? `${belts}-DIVISION CHAMPION` : c.champ ? `${c.division.toUpperCase()} CHAMPION` : belts ? 'FORMER CHAMPION' : c.rank ? `#${c.rank} ${c.division.toUpperCase()}` : TIERS[c.tier].name.toUpperCase();
  ctx.fillText(title, 64, 234);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 118px system-ui, sans-serif'; ctx.fillText(c.record[2] ? c.record.join('-') : `${c.record[0]}-${c.record[1]}`, 60, 372);
  const stats: [string, string][] = [['KO', String(c.finishes.ko)], ['SUB', String(c.finishes.sub)], ['OVR', String(overall(c.stats))], ['LEGACY', String(legacy(c))]];
  stats.forEach(([k, v], i) => {
    const x = 64 + i * 158; ctx.fillStyle = '#ffffff14'; ctx.beginPath(); ctx.roundRect(x, 412, 144, 104, 16); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '900 44px system-ui, sans-serif'; ctx.fillText(v, x + 16, 468); ctx.fillStyle = '#b9bdcc'; ctx.font = '700 20px system-ui, sans-serif'; ctx.fillText(k, x + 16, 500);
  });
  ctx.fillStyle = '#b9bdcc'; ctx.font = '700 26px system-ui, sans-serif'; ctx.fillText('Build your legend at versusarena.org', 64, 580);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}

/** share the card where the device supports it, otherwise download it. Returns what happened. */
export async function shareCareer(c: Career): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await careerCard(c); if (!blob) return 'failed';
  const name = `${c.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-versus-career.png`, file = new File([blob], name, {type: 'image/png'});
  try { if (navigator.canShare?.({files: [file]})) { await navigator.share({files: [file], title: `${c.name} on VERSUS`}); return 'shared'; } }
  catch (e) { if ((e as DOMException).name === 'AbortError') return 'failed'; }
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
