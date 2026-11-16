'use client';
import {useRef, useState} from 'react';
import {Search, Swords, Sparkles, Trophy, Lightbulb, ArrowRight} from 'lucide-react';
import {competitors} from '../lib/competitors';
import type {Competitor} from '../lib/domain';
import {moments} from '../lib/moments';
import {Portrait} from './ui';

const legends = ['jones', 'gsp', 'khabib', 'amanda-nunes'];
const featured = moments.find(m => m.id === 'holloway-last-second') ?? moments[0];
const tierSticker: Record<string, string> = {Legendary: 'sun', Iconic: 'violet', Classic: 'sky'};

const paths = [
  {href: '/fighters', icon: Search, tone: 'lime', title: 'Fighter database', body: `${competitors.length} careers with records, reach, striking and grappling stats.`},
  {href: '/compare', icon: Swords, tone: 'pink', title: 'Head to head', body: 'Put any two fighters side by side and settle the argument.'},
  {href: '/moments', icon: Sparkles, tone: 'sun', title: `${moments.length} Moments`, body: 'Collect the finishes and title nights that made UFC history.'},
  {href: '/fantasy', icon: Trophy, tone: 'sky', title: 'Fight night', body: 'Draft five fighters from a real card and score on real results.'},
];

function HoloMoment() {
  const card = useRef<HTMLAnchorElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = card.current; if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.add('is-live');
    el.style.setProperty('--ry', `${((x - .5) * 24).toFixed(1)}deg`);
    el.style.setProperty('--rx', `${((.5 - y) * 24).toFixed(1)}deg`);
    el.style.setProperty('--mx', `${Math.round(x * 100)}%`);
    el.style.setProperty('--my', `${Math.round(y * 100)}%`);
    el.style.setProperty('--shine', '1');
  };
  const leave = () => {
    const el = card.current; if (!el) return;
    el.classList.remove('is-live');
    ['--rx', '--ry'].forEach(p => el.style.setProperty(p, '0deg'));
    el.style.setProperty('--shine', '0');
  };
  return <div className="holo-stage">
    <a ref={card} className="holo-moment" href={`/moments?q=${encodeURIComponent(featured.name)}`} onPointerMove={move} onPointerLeave={leave} aria-label={`${featured.title} — ${featured.name}, ${featured.event}. View in Moments`}>
      <span className={`sticker ${tierSticker[featured.tier] ?? 'sun'}`}>{featured.tier}</span>
      <span className="holo-art" aria-hidden="true">VS</span>
      <span className="holo-foil" aria-hidden="true"/>
      <span className="holo-glare" aria-hidden="true"/>
      <span className="holo-meta">
        <span className="holo-event">{featured.event} · {featured.date}</span>
        <strong>{featured.title.toLowerCase()}</strong>
        <span className="holo-name">{featured.name}</span>
      </span>
    </a>
  </div>;
}

export function ArchiveHome() {
  const [q, setQ] = useState('');
  const legendCards = legends.map(id => competitors.find(c => c.id === id)).filter((c): c is Competitor => !!c);
  return <div className="bn-home">
    <section className="bn-hero">
      <div className="bn-hero-copy">
        <span className="eyebrow">The UFC fighter archive</span>
        <h1>Know the fighters. <em>See it all.</em></h1>
        <p className="bn-sub">Explore {competitors.length} UFC careers, put anyone head to head, collect {moments.length} Moments, and draft real fight cards.</p>
        <form className="bn-search" action="/fighters" role="search">
          <Search size={20} aria-hidden="true"/>
          <label className="sr-only" htmlFor="home-search">Search fighters</label>
          <input id="home-search" name="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a fighter…" autoComplete="off"/>
          <button className="button primary">Explore</button>
        </form>
        <div className="bn-ctas">
          <a className="button outline" href="/compare">Build a matchup</a>
          <a className="button outline" href="/fantasy">Play fight night</a>
        </div>
      </div>
      <HoloMoment/>
    </section>

    <section className="bn-paths" aria-label="Explore VERSUS">
      {paths.map(({href, icon: Icon, tone, title, body}) => <a key={href} href={href} className={`panel bn-path tone-${tone}`}>
        <span className="bn-path-icon" aria-hidden="true"><Icon size={22}/></span>
        <h2>{title}</h2>
        <p>{body}</p>
        <span className="bn-path-go" aria-hidden="true"><ArrowRight size={18}/></span>
      </a>)}
    </section>

    <section className="bn-legends">
      <div className="section-heading">
        <div><span className="eyebrow">Start with a legend</span><h2>Four careers worth knowing</h2></div>
        <a href="/fighters">All {competitors.length} fighters →</a>
      </div>
      <div className="bn-legend-grid">
        {legendCards.map((c, i) => <a href={`/fighter/${c.id}`} className="panel bn-legend" key={c.id} style={{'--tilt': `${i % 2 ? 2 : -2}deg`} as React.CSSProperties}>
          <Portrait c={c}/>
          <span className="bn-legend-body">
            <span className="bn-legend-div">{c.division}</span>
            <strong className="bn-legend-name">{c.name}</strong>
            <span className="bn-legend-rec">{c.record.join('–')}</span>
          </span>
        </a>)}
      </div>
    </section>

    <section className="panel bn-community">
      <div>
        <span className="eyebrow">Your corner</span>
        <h2>Find your people. Flex your collection.</h2>
        <p>Add friends, customize your profile, and earn free Arena Coins on every fight night.</p>
      </div>
      <div className="bn-ctas">
        <a className="button primary" href="/people">Find friends</a>
        <a className="button outline" href="/shop">Visit the shop</a>
        <a className="button outline" href="/leaderboard">Coin leaderboard</a>
        <a className="button outline" href="/suggestions"><Lightbulb size={16} aria-hidden="true"/>Suggest a feature</a>
      </div>
    </section>
  </div>;
}
