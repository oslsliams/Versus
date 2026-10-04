export function photoCrop(width:number,height:number,zoom:number,left:number,top:number){
 const scale=Math.max(1,Math.min(4,zoom)),side=Math.min(width,height)/scale;
 const clamp=(n:number)=>Math.max(-100,Math.min(100,n));
 return{side,x:(width-side)*(clamp(left)+100)/200,y:(height-side)*(clamp(top)+100)/200};
}
