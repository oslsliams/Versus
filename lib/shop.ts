export type ShopKind='frame'|'banner'|'title';
export type ShopItem={id:string;kind:ShopKind;value:string;name:string;price:number;description:string};
export const shopItems:ShopItem[]=[
  {id:'frame-gold',kind:'frame',value:'gold',name:'Championship Gold',price:300,description:'A gold ring worthy of the top of the card.'},
  {id:'frame-neon',kind:'frame',value:'neon',name:'Neon Corner',price:150,description:'An electric green glow for your avatar.'},
  {id:'frame-ice',kind:'frame',value:'ice',name:'Ice Cold',price:250,description:'A cool blue frame for calm under pressure.'},
  {id:'banner-aurora',kind:'banner',value:'aurora',name:'Northern Lights',price:400,description:'Bring an aurora of green and violet to your profile.'},
  {id:'banner-crimson',kind:'banner',value:'crimson',name:'Red Corner',price:250,description:'A dramatic crimson backdrop for fight night.'},
  {id:'banner-gold',kind:'banner',value:'gold',name:'Main Event',price:500,description:'A warm gold spotlight for your corner.'},
  {id:'title-matchmaker',kind:'title',value:'matchmaker',name:'The Matchmaker',price:100,description:'The person who knows which matchup comes next.'},
  {id:'title-cage',kind:'title',value:'cage',name:'Cage Scholar',price:200,description:'For the student of every round and every finish.'},
  {id:'title-main',kind:'title',value:'main',name:'Main Event Energy',price:350,description:'Make every appearance feel like the headline.'}
];
export const styleDefaults={frame:'classic',banner:'arena',title:'contender'};
export const profileTitle=(value?:string)=>shopItems.find(i=>i.kind==='title'&&i.value===value)?.name??'VERSUS CONTENDER';
