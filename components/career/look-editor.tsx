'use client';
// Character customisation: body, fight kit colours, tattoos and gear, with a live 3D preview.
// At creation the free items are open; premium ink and walkout gear are bought with career money.
import {useState} from 'react';
import {Lock, Check} from 'lucide-react';
import {BODIES, DARIO_DEFAULT, DARIO_PARTS, GEAR, KIT_COLORS, TATTOOS, type Look} from '../../lib/cosmetics';
import {FighterPreview} from '../fight3d/preview';

const money = (n: number) => '$' + Math.round(n).toLocaleString();

export function LookEditor({look, onChange, owned = [], cash, onBuy}: {look: Look; onChange: (l: Look) => void; owned?: string[]; cash?: number; onBuy?: (id: string, price: number) => void}) {
  const [tab, setTab] = useState<'body' | 'kit' | 'ink' | 'gear' | 'hair' | 'dshorts' | 'dink'>('body');
  // Dario Vale is customised with his own parts (hairstyles, shorts, tattoos built for his body)
  const custom = look.model === 'dario';
  const parts = {...DARIO_DEFAULT, ...look.parts};
  const setPart = (k: 'hair' | 'shorts', id: string) => onChange({...look, parts: {...parts, [k]: id}});
  const toggleInk = (id: string) => onChange({...look, parts: {...parts, ink: parts.ink.includes(id) ? parts.ink.filter(x => x !== id) : [...parts.ink, id]}});
  const TABS = custom ? [['body', 'Body'], ['hair', 'Hair'], ['dshorts', 'Shorts'], ['dink', 'Tattoos']] as const : [['body', 'Body'], ['kit', 'Fight kit'], ['ink', 'Tattoos'], ['gear', 'Gear']] as const;
  const part = (on: boolean, name: string, onClick: () => void, radio = true) => <button key={name} type="button" role={radio ? 'radio' : undefined} aria-checked={radio ? on : undefined} aria-pressed={radio ? undefined : on} className={`le-part ${on ? 'on' : ''}`} onClick={onClick}><strong>{name}</strong>{on && <Check className="le-check" size={16} aria-hidden="true"/>}</button>;
  const has = (id: string, price: number) => price === 0 || owned.includes(id);
  const toggle = (list: 'tattoos' | 'gear', id: string) => onChange({...look, [list]: look[list].includes(id) ? look[list].filter(x => x !== id) : [...look[list], id]});
  const item = (list: 'tattoos' | 'gear', c: {id: string; name: string; where: string; price: number}, art?: string) => {
    const on = look[list].includes(c.id), open = has(c.id, c.price);
    return <div key={c.id} className={`le-item ${on ? 'on' : ''} ${open ? '' : 'locked'}`}>
      <button type="button" aria-pressed={on} disabled={!open} onClick={() => toggle(list, c.id)}>
        {art ? <img src={art} alt="" loading="lazy"/> : <span className="le-gear" aria-hidden="true">{c.name.split(' ').map(w => w[0]).join('')}</span>}
        <strong>{c.name}</strong><small>{c.where}</small>
        {on && <Check className="le-check" size={16} aria-label="Wearing"/>}
      </button>
      {!open && (onBuy ? <button type="button" className="button outline le-buy" disabled={(cash ?? 0) < c.price} onClick={() => onBuy(c.id, c.price)}>Buy {money(c.price)}</button>
        : <span className="le-lock"><Lock size={13} aria-hidden="true"/> {money(c.price)} in career</span>)}
    </div>;
  };
  return <div className="le">
    <FighterPreview look={look} focus={tab === 'ink' || tab === 'dink' || tab === 'hair' ? 'upper' : 'body'}/>
    <div className="le-side">
      <div className="bn-seg le-tabs" role="tablist" aria-label="Customise">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'body' && <div className="le-grid bodies" role="radiogroup" aria-label="Body">
        {BODIES.map(b => <button key={b.model} type="button" role="radio" aria-checked={look.model === b.model} className={`le-body ${look.model === b.model ? 'on' : ''}`} onClick={() => { onChange({...look, model: b.model}); if (b.model === 'dario' ? ['kit', 'ink', 'gear'].includes(tab) : ['hair', 'dshorts', 'dink'].includes(tab)) setTab('body'); }}>
          <img src={`/fighters/${b.model}-stance.webp`} alt="" loading="lazy"/><small>{b.label}</small>
        </button>)}
      </div>}
      {!custom && tab === 'kit' && <div className="le-kit">
        {([['shorts', 'Shorts'], ['trim', 'Waistband & trim'], ['gloves', 'Gloves']] as const).map(([k, l]) => <div key={k}>
          <span className="cg-label">{l}</span>
          <div className="cg-colors" role="radiogroup" aria-label={l}>
            {(k === 'gloves' ? ['#141416', '#f1f1f3', '#c2242f', '#2459d6', '#e9c873'] : KIT_COLORS).map(col => <button key={col} type="button" role="radio" aria-checked={look[k] === col} aria-label={col} className={look[k] === col ? 'on' : ''} style={{background: col}} onClick={() => onChange({...look, [k]: col})}/>)}
          </div>
        </div>)}
      </div>}
      {custom && tab === 'hair' && <div className="le-grid parts" role="radiogroup" aria-label="Hairstyle">{DARIO_PARTS.hair.map(h => part(parts.hair === h.id, h.name, () => setPart('hair', h.id)))}</div>}
      {custom && tab === 'dshorts' && <div className="le-grid parts" role="radiogroup" aria-label="Shorts">{DARIO_PARTS.shorts.map(s => part(parts.shorts === s.id, s.name, () => setPart('shorts', s.id)))}</div>}
      {custom && tab === 'dink' && <div className="le-grid parts">{DARIO_PARTS.ink.map(t => part(parts.ink.includes(t.id), t.name, () => toggleInk(t.id), false))}</div>}
      {!custom && tab === 'ink' && <div className="le-grid">{TATTOOS.map(t => item('tattoos', t, `/cosmetics/tattoos/${t.id}-art.png`))}</div>}
      {!custom && tab === 'gear' && <div className="le-grid">{GEAR.map(g => item('gear', g))}</div>}
      <p className="muted le-note">{custom ? 'Dario Vale by UNSEEN Interactive: 23 hairstyles, 7 fight shorts and 20 tattoos built for his body.' : 'Tattoos and gear are built in 3D and wrapped onto your body. Walkout gear (chain, bandana) comes off before the first bell.'}</p>
    </div>
  </div>;
}
