// Country code only: never expose or store the visitor's IP address.
export function onRequestGet({request}){
 const value=request.cf?.country;
 const country=typeof value==='string'&&/^[A-Z]{2}$/.test(value)&&!['XX','T1'].includes(value)?value:null;
 return Response.json({country},{headers:{'Cache-Control':'private, no-store','Vary':'CF-IPCountry'}});
}
