import type {Category} from './domain';
export const categories:Category[]=[
{id:'mma',name:'Mixed martial arts',short:'MMA',enabled:true,attributes:['Striking','Power','Speed','Defense','Grappling','Wrestling','Cardio','Fight IQ','Durability'],weights:{Striking:.16,Power:.09,Speed:.08,Defense:.12,Grappling:.13,Wrestling:.12,Cardio:.1,'Fight IQ':.12,Durability:.08}},
{id:'nba',name:'Basketball',short:'NBA',enabled:false,attributes:['Shooting','Playmaking','Defense','Athleticism'],weights:{Shooting:.3,Playmaking:.25,Defense:.25,Athleticism:.2}},
{id:'soccer',name:'Soccer',short:'Soccer',enabled:false,attributes:['Finishing','Passing','Defense','Pace'],weights:{Finishing:.3,Passing:.3,Defense:.2,Pace:.2}},
{id:'anime',name:'Anime & manga',short:'Anime',enabled:false,attributes:['Strength','Speed','Intelligence','Hax','Durability'],weights:{Strength:.25,Speed:.2,Intelligence:.15,Hax:.2,Durability:.2}},
{id:'gaming',name:'Video games',short:'Gaming',enabled:false,attributes:['Damage','Mobility','Defense','Utility'],weights:{Damage:.3,Mobility:.25,Defense:.25,Utility:.2}}];
