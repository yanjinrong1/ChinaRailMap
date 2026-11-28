// Auto-open only for a new complete station pair; preserve a user's manual hide
// while the same journey is rerendered or its geometry finishes loading.
export function nextMobileSheet(state,origin,destination){
 if(!origin||!destination)return {key:null,expanded:false};
 const key=JSON.stringify([origin,destination]);return key===state.key?state:{key,expanded:true};
}
