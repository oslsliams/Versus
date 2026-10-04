'use client';
import type {Person} from '../lib/domain';
import photos from '../lib/fighter-photos.json';
const photoMap:Record<string,{url:string}>=photos;
export default function UserAvatar({person,large=false}:{person?:Person;large?:boolean}){const image=person?.avatar?.startsWith('fighter:')?photoMap[person.avatar.slice(8)]?.url:null;const emoji=person?.avatar?.startsWith('emoji:')?person.avatar.slice(6):null;return <span className={`avatar custom-avatar frame-${person?.profileFrame??'classic'} ${large?'giant':''}`} style={{'--profile-accent':person?.accent??'#c5f74f'} as React.CSSProperties}>{image?<img src={image} alt="" loading="lazy"/>:emoji??(person?.username??'Contender').slice(0,2).toUpperCase()}</span>;}
