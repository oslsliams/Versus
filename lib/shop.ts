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
,{"id":"frame-ember","kind":"frame","value":"ember","name":"Ember Corner","price":225,"description":"A fiery orange ring for your profile."},
{"id":"frame-violet","kind":"frame","value":"violet","name":"Midnight Violet","price":275,"description":"A violet glow for late-night fight fans."},
{"id":"frame-steel","kind":"frame","value":"steel","name":"Octagon Steel","price":175,"description":"A brushed metal border with cage-side energy."},
{"id":"frame-rose","kind":"frame","value":"rose","name":"Rose Gold","price":325,"description":"Warm pink and gold around your avatar."},
{"id":"frame-electric","kind":"frame","value":"electric","name":"Electric Blue","price":350,"description":"A bright blue double ring."},
{"id":"banner-cage","kind":"banner","value":"cage","name":"Inside the Cage","price":300,"description":"A patterned cage backdrop."},
{"id":"banner-sunset","kind":"banner","value":"sunset","name":"Last Round Sunset","price":350,"description":"Orange fades into violet after fight night."},
{"id":"banner-ocean","kind":"banner","value":"ocean","name":"Blue Corner","price":250,"description":"Deep blue waves for your corner."},
{"id":"banner-carbon","kind":"banner","value":"carbon","name":"Carbon Arena","price":200,"description":"Dark stripes with a clean finish."},
{"id":"banner-violet","kind":"banner","value":"violet","name":"Midnight Show","price":375,"description":"A violet spotlight for your profile."},
{"id":"banner-mint","kind":"banner","value":"mint","name":"Fresh Camp","price":225,"description":"A fresh green gradient."},
{"id":"title-historian","kind":"title","value":"historian","name":"Fight Historian","price":150,"description":"For the fan who remembers every era."},
{"id":"title-collector","kind":"title","value":"collector","name":"Moment Collector","price":200,"description":"A title for your growing archive."},
{"id":"title-analyst","kind":"title","value":"analyst","name":"The Analyst","price":250,"description":"You always check the numbers."},
{"id":"title-ringside","kind":"title","value":"ringside","name":"Ringside Regular","price":125,"description":"A familiar face on fight night."},
{"id":"title-southpaw","kind":"title","value":"southpaw","name":"Southpaw Society","price":175,"description":"A different angle on the sport."},
{"id":"title-five-rounds","kind":"title","value":"five-rounds","name":"Five Round Fan","price":225,"description":"Here from the opener to the final horn."},
{"id":"title-archivist","kind":"title","value":"archivist","name":"The Archivist","price":300,"description":"Keep the history alive."}
];
export const styleDefaults={frame:'classic',banner:'arena',title:'contender'};
export const profileTitle=(value?:string)=>shopItems.find(i=>i.kind==='title'&&i.value===value)?.name??'VERSUS CONTENDER';
