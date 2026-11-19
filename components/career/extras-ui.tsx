'use client';
// Fighter tab: signature move, career stats, division records and achievements. Team tab: training trips abroad.
// Division tab: a "Call out" button next to a name.
import {Megaphone, Plane, Trophy, Lock} from 'lucide-react';
import type {Career} from '../../lib/career/engine';
import {ACHIEVEMENTS, TRIPS, TRIP_WEEKS, bookTrip, callOut, canCallOut, divisionRecords, tripPrice} from '../../lib/career/extras';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function CareerExtras({c}: {c: Career}) {
  const x = c.extra ?? {}, s = x.stats, got = x.ach ?? {};
  const acc = s && s.thrown ? Math.round(s.landed / s.thrown * 100) : 0;
  const unlocked = ACHIEVEMENTS.filter(a => got[a.id]).length;
  return <>
    {(x.sig || x.hof) && <section className="panel cg-legacy-tags">
      {x.sig && <p><span className="sticker sun">Signature</span> The {x.sig.toLowerCase()}. Three wins with it and counting.</p>}
      {x.hof && <p><span className="sticker violet">Hall of Fame</span> Inducted into the VERSUS Hall of Fame.</p>}
    </section>}
    <section className="panel cg-cstats">
      <div className="section-heading"><h2>Career stats</h2><span className="muted">From the fights you played live</span></div>
      {s && s.fights ? <dl>
        <div><dt>Strikes landed</dt><dd>{s.landed.toLocaleString()}</dd></div>
        <div><dt>Accuracy</dt><dd>{acc}%</dd></div>
        <div><dt>Takedowns</dt><dd>{s.takedowns}</dd></div>
        <div><dt>Knockdowns scored</dt><dd>{s.kdFor}</dd></div>
        <div><dt>Times dropped</dt><dd>{s.kdAgainst}</dd></div>
        <div><dt>Control time</dt><dd>{Math.floor(s.ctrl / 60)}:{String(s.ctrl % 60).padStart(2, '0')}</dd></div>
        <div><dt>Round-1 finishes</dt><dd>{s.firstRoundFinishes}</dd></div>
        <div><dt>Comebacks</dt><dd>{s.comebacks}</dd></div>
        <div><dt>Opponents cut</dt><dd>{s.cutsOpened}</dd></div>
      </dl> : <p className="muted">Fight live to start your career stats.</p>}
    </section>
    <section className="panel cg-records">
      <div className="section-heading"><h2>{c.division} record book</h2><span className="muted">Beat the marks to own them</span></div>
      <ul>{divisionRecords(c).map(r => <li key={r.id} className={r.broken ? 'broken' : ''}>
        <span><strong>{r.label[0].toUpperCase() + r.label.slice(1).replace(' in division history', '')}</strong><small>{r.broken ? 'Yours' : `Record: ${r.n}`}</small></span>
        <span className="cg-rec-bar" role="img" aria-label={`${r.mine} of ${r.n + 1}`}><u style={{width: `${Math.min(100, r.mine / (r.n + 1) * 100)}%`}}/></span><b>{r.mine}</b>
      </li>)}</ul>
    </section>
    <section className="panel cg-ach">
      <div className="section-heading"><h2>Achievements</h2><span className="muted">{unlocked} of {ACHIEVEMENTS.length}</span></div>
      <ul>{ACHIEVEMENTS.map(a => <li key={a.id} className={got[a.id] ? 'on' : ''} title={a.hint}>
        {got[a.id] ? <Trophy size={18} aria-hidden="true"/> : <Lock size={16} aria-hidden="true"/>}<span><strong>{a.label}</strong><small>{a.hint}</small></span>
      </li>)}</ul>
    </section>
  </>;
}

export function Trips({c, update}: {c: Career; update: (c: Career | null) => void}) {
  const t = c.extra?.trip, price = tripPrice(c);
  return <section className="panel cg-trips">
    <div className="section-heading"><h2><Plane size={18} aria-hidden="true"/> Training trips</h2><span className="muted">{TRIP_WEEKS} weeks · {money(price)}</span></div>
    {t ? <p className="muted">You're at the {TRIPS.find(x => x.id === t.id)?.label}. {t.left} week{t.left === 1 ? '' : 's'} left.</p>
      : <p className="muted">Travel to learn from the best. While you're there, two stats grow 60% faster in training and sparring.</p>}
    <ul>{TRIPS.map(x => <li key={x.id}><span><strong>{x.label}</strong><small>{x.blurb} {x.stats.map(s => s[0].toUpperCase() + s.slice(1)).join(' + ')}.</small></span>
      <button type="button" className="button outline" disabled={!!t || c.money < price || c.injuryWeeks > 0} onClick={() => update(bookTrip(c, x.id))}>Book</button></li>)}</ul>
  </section>;
}

export function CallOutButton({c, id, update}: {c: Career; id: string; update: (c: Career | null) => void}) {
  if (id === 'you' || !canCallOut(c)) return null;
  return <button type="button" className="cg-callout" onClick={() => update(callOut(c, id))} aria-label="Call him out"><Megaphone size={13} aria-hidden="true"/>Call out</button>;
}
