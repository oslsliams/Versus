'use client';
// The fighter's smartphone: everything that happens around the training goes here instead of filling the page.
// Messages (decisions from your coach, manager, family and rivals), Feed, News, Your story, Bank and Settings.
// Docked beside the hub on wide screens; on phones and tablets it slides up from the floating phone button.
import {useEffect, useRef, useState} from 'react';
import {AtSign, BookOpen, ChevronLeft, Contact, Dumbbell, Flag, Landmark, MessageCircle, Newspaper, RotateCcw, Settings, Users, X} from 'lucide-react';
import {MuteButton} from '../fight3d/mute-button';
import {COACHES, LIVING, npc, resolveChoice, retire, setSkipDrills, weeklyCost, type Career, type CastKey, type CoachKey} from '../../lib/career/engine';

export const money = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString();
export const yearWeek = (w: number) => `Year ${Math.floor((w - 1) / 52) + 1} · Week ${((w - 1) % 52) + 1}`;
export const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n));

export type PhoneApp = 'home' | 'messages' | 'people' | 'feed' | 'news' | 'story' | 'bank' | 'settings';
const APPS = [
  {id: 'messages', label: 'Messages', Icon: MessageCircle}, {id: 'people', label: 'People', Icon: Contact}, {id: 'feed', label: 'Feed', Icon: AtSign}, {id: 'news', label: 'News', Icon: Newspaper},
  {id: 'story', label: 'Story', Icon: BookOpen}, {id: 'bank', label: 'Bank', Icon: Landmark}, {id: 'settings', label: 'Settings', Icon: Settings},
] as const;
const TITLES: Record<Exclude<PhoneApp, 'home'>, string> = {messages: 'Messages', people: 'People', feed: 'Feed', news: 'Fight news', story: 'Your story', bank: 'Bank', settings: 'Settings'};
const CAST_ORDER: CastKey[] = ['coach', 'manager', 'brother', 'friend', 'partner'];
const bondLabel = (n: number) => n >= 75 ? 'Would do anything for you' : n >= 55 ? 'Solid' : n >= 35 ? 'Getting distant' : 'Barely speaking';

export function CareerPhone({c, update, app, setApp, open, onClose, onTeam}: {c: Career; update: (c: Career | null) => void; app: PhoneApp; setApp: (a: PhoneApp) => void; open: boolean; onClose: () => void; onTeam: () => void}) {
  const threads = c.threads ?? [];
  const nemesis = c.nemesis ? npc(c, c.nemesis) : undefined;
  const [confirm, setConfirm] = useState<'retire' | 'new' | null>(null);
  const feedKey = c.feed?.[0] ? c.feed[0].week + c.feed[0].text : '', newsKey = c.log[0] ? c.log[0].week + c.log[0].text : '';
  const [seen, setSeen] = useState({feed: feedKey, news: newsKey});
  const body = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  // opening Feed or News clears its badge
  useEffect(() => { if (app === 'feed' || app === 'news') setSeen(s => ({...s, feed: app === 'feed' ? feedKey : s.feed, news: app === 'news' ? newsKey : s.news})); }, [app, feedKey, newsKey]);
  // chats open at the newest message; other apps open at the top
  useEffect(() => { const el = body.current; if (el) el.scrollTop = app === 'messages' ? el.scrollHeight : 0; }, [app, threads.length, c.choice?.title]);
  // as a slide-up sheet: Escape closes it and the page behind stays still
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key); };
  }, [open, onClose]);

  const newCount = (items: {week: number; text: string}[], key: string) => { const i = items.findIndex(x => x.week + x.text === key); return i < 0 ? Math.min(items.length, 9) : Math.min(i, 9); };
  const badge: Partial<Record<PhoneApp, number>> = {messages: c.choice ? 1 : 0, feed: newCount(c.feed ?? [], seen.feed), news: newCount(c.log, seen.news)};
  const answer = (id: string) => update(resolveChoice(c, id));
  const opp = c.camp ? c.roster.find(n => n.id === c.camp!.opponentId) : undefined;
  const team = (Object.entries(c.team ?? {}) as [CoachKey, number][]).filter(([, l]) => l);

  return <>
    {open && <div className="cp-scrim" onClick={onClose} aria-hidden="true"/>}
    <aside className={`cp ${open ? 'open' : ''}`} aria-label="Your phone">
      <div className="cp-screen">
        <div className="cp-status" aria-hidden="true"><span>Wk {((c.week - 1) % 52) + 1}</span><i className="cp-island"/><span className="cp-batt">{Math.round(c.energy)}%<b><u style={{width: `${c.energy}%`}}/></b></span></div>
        {app === 'home' ? <div className="cp-home" ref={body}>
          <div className="cp-widget">
            <small>{yearWeek(c.week)}</small>
            {c.camp && opp ? <><strong>vs {opp.name}</strong><span>{c.camp.weeksLeft === 0 ? 'Fight week' : `${c.camp.weeksLeft} week${c.camp.weeksLeft === 1 ? '' : 's'} out`}{c.camp.event ? ` · ${c.camp.event}` : ''}</span></>
              : <><strong>No fight booked</strong><span>{c.offers.length ? `${c.offers.length} offer${c.offers.length === 1 ? '' : 's'} waiting` : 'Your manager is on the phones'}</span></>}
          </div>
          <div className="cp-apps">{APPS.map(a => <button key={a.id} type="button" className={`cp-app ${a.id}`} onClick={() => setApp(a.id)} aria-label={`${a.label}${badge[a.id] ? `, ${badge[a.id]} new` : ''}`}>
            <span className="cp-icon"><a.Icon size={25} aria-hidden="true"/>{!!badge[a.id] && <b>{badge[a.id]}</b>}</span>{a.label}
          </button>)}</div>
        </div> : <>
          <header className="cp-bar"><button type="button" onClick={() => setApp('home')} aria-label="Back to home screen"><ChevronLeft size={22} aria-hidden="true"/></button><h2>{TITLES[app]}</h2></header>
          <div className="cp-body" ref={body}>
            {app === 'messages' && <div className="cp-chat">
              {!threads.length && !c.choice && <p className="cp-empty">No messages yet. When {c.cast?.coach.short ?? 'your coach'}, {c.cast?.manager.short ?? 'your manager'}, your family or a rival needs you, it lands here.</p>}
              {threads.map((t, i) => <div key={`${t.week}-${i}`} className="cp-thread done">
                <span className="cp-from">{t.from} · {yearWeek(t.week)}</span><p className="cp-in">{t.title && <b>{t.title}</b>}{t.text}</p>{t.answer && <p className="cp-out">{t.answer}</p>}{t.result && <p className="cp-in result">{t.result}</p>}
              </div>)}
              {c.choice && <div className="cp-thread" aria-live="polite">
                <span className="cp-from">{c.choice.kind === 'press' ? 'Fight week media' : c.choice.from ?? 'Message'}</span>
                <p className="cp-in"><b>{c.choice.title}</b>{c.choice.text}</p>
                <div className="cp-replies">{c.choice.options.map(o => <button key={o.id} type="button" onClick={() => answer(o.id)}><strong>{o.label}</strong><small>{o.hint}</small></button>)}</div>
              </div>}
            </div>}
            {app === 'people' && c.cast && <div className="cp-people">
              <ul>{CAST_ORDER.map(k => { const p = c.cast![k], b = c.bonds?.[k] ?? 50; return <li key={k}>
                <i aria-hidden="true">{p.short.replace(/^(Coach|Kru|Professor|Dr\.) /, '').slice(0, 1)}</i>
                <span><strong>{p.name}</strong><small>{p.role} · {bondLabel(b)}</small><span className="cp-bond" role="img" aria-label={`Relationship ${Math.round(b)} of 100`}><u style={{width: `${b}%`}}/></span></span>
              </li>; })}</ul>
              {nemesis && <div className="cp-nemesis"><small>The name you can't forget</small><strong>{nemesis.name}</strong><span>{nemesis.record.join('–')} · {nemesis.tier === c.tier ? 'In your league now' : nemesis.tier < c.tier ? 'Still climbing toward you' : 'Waiting above you'}</span></div>}
            </div>}
            {app === 'feed' && <>
              <p className="cp-sum"><strong>{compact(c.followers ?? 0)}</strong> followers</p>
              {(c.feed ?? []).length ? <ol className="cp-list">{(c.feed ?? []).slice(0, 25).map((p, i) => <li key={i} className={p.you ? 'you' : ''}><b>{p.handle}{p.you ? ' · you' : ''}</b><p>{p.text}</p><small>♥ {compact(p.likes)} · {yearWeek(p.week)}</small></li>)}</ol> : <p className="cp-empty">Nobody is talking about you yet. Win something.</p>}
            </>}
            {app === 'news' && <ol className="cp-list news">{c.log.slice(0, 30).map((l, i) => <li key={i} className={l.tone ?? ''}><small>{yearWeek(l.week)}</small><p>{l.text}</p></li>)}</ol>}
            {app === 'story' && ((c.milestones ?? []).length ? <ol className="cp-time">{(c.milestones ?? []).map((m, i) => <li key={i}><small>Age {m.age}</small><p>{m.text}</p></li>)}</ol> : <p className="cp-empty">Your story starts with your first fight.</p>)}
            {app === 'bank' && <div className="cp-bank">
              <div className="cp-card"><small>Balance</small><strong className={c.money < 0 ? 'neg' : ''}>{money(c.money)}</strong><span>Career earnings {money(c.earnings ?? 0)}</span></div>
              <h3>Every week</h3>
              <dl><div><dt>Rent and food</dt><dd>−{money(LIVING[c.tier])}</dd></div>
                {team.map(([k, l]) => <div key={k}><dt>{COACHES[k].label}</dt><dd>−{money(COACHES[k].pay[l])}</dd></div>)}
                <div className="total"><dt>Total bills</dt><dd>−{money(weeklyCost(c))}</dd></div></dl>
              {(c.yearPurses ?? 0) > 0 && <><h3>Due on your birthday</h3><dl><div><dt>Tax on this year's purses (25%)</dt><dd>−{money((c.yearPurses ?? 0) * .25)}</dd></div></dl></>}
              {c.lastPayout && <><h3>Last purse</h3>
                <dl><div><dt>Gross</dt><dd>{money(c.lastPayout.gross)}</dd></div><div><dt>Manager</dt><dd>−{money(c.lastPayout.manager)}</dd></div><div><dt>Gym</dt><dd>−{money(c.lastPayout.gym)}</dd></div>
                  {!!c.lastPayout.bonus && <div><dt>Bonus</dt><dd>{money(c.lastPayout.bonus)}</dd></div>}
                  <div className="total"><dt>You kept</dt><dd>{money(c.lastPayout.net + c.lastPayout.bonus)}</dd></div></dl></>}
              <button type="button" className="button outline" onClick={onTeam}><Users size={16} aria-hidden="true"/>Manage your team</button>
            </div>}
            {app === 'settings' && <div className="cp-settings">
              {confirm ? <div role="alertdialog" aria-label="Confirm">
                <p>{confirm === 'retire' ? 'Retire now? Your career ends and gets its legacy score.' : 'Start over? This career is deleted from this device.'}</p>
                <button type="button" className="button primary" onClick={() => { update(confirm === 'retire' ? retire(c) : null); setConfirm(null); }}>{confirm === 'retire' ? 'Retire' : 'Delete and restart'}</button>
                <button type="button" className="button outline" onClick={() => setConfirm(null)}>Cancel</button>
              </div> : <>
                <p className="cp-empty">Your career saves on this device.</p>
                <MuteButton label className="button outline"/>
                <button type="button" className="button outline" role="switch" aria-checked={!!c.skipDrills} onClick={() => update(setSkipDrills(c, !c.skipDrills))}><Dumbbell size={16} aria-hidden="true"/>Skip training drills: {c.skipDrills ? 'On' : 'Off'}</button>
                <p className="cp-hint">{c.skipDrills ? 'Training and sparring go straight through, but every session gives half the gains.' : 'Play a short drill each training week. A great one is worth about twice a poor one.'}</p>
                <button type="button" className="button outline" onClick={() => setConfirm('retire')}><Flag size={16} aria-hidden="true"/>Retire</button>
                <button type="button" className="button outline" onClick={() => setConfirm('new')}><RotateCcw size={16} aria-hidden="true"/>New career</button>
              </>}
            </div>}
          </div>
        </>}
        <button type="button" className="cp-homebar" onClick={() => setApp('home')} aria-label="Home screen"><i/></button>
      </div>
      <button ref={closeBtn} type="button" className="cp-close" onClick={onClose} aria-label="Put your phone away"><X size={20} aria-hidden="true"/></button>
    </aside>
  </>;
}
