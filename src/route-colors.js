// Visual train grouping only; never changes the category used by the rail router.
export const ROUTE_COLORS={highspeed:'#d92535',conventional:'#14563e',intercity:'#1678d4'};
export const DARK_ROUTE_COLORS={highspeed:'#ff5a63',conventional:'#398c66',intercity:'#58acff'};
export const ROUTE_CLASS_ORDER=['highspeed','conventional','intercity'];
export function trainRouteClass(train){
 const code=String(train.code||train.id||'').trim().toUpperCase();
 if(/^[GD]/.test(code))return 'highspeed';
 if(/^[CS]/.test(code))return 'intercity';
 return 'conventional';
}
