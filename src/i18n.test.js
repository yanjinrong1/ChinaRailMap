import {test}from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML}from 'linkedom';
import {languageForCountry,languageForBrowser,translateText,registerStationNames,createTranslator,detectCountry,addTranslations}from './i18n.js';
import copy from './i18n-copy.js';
import {onRequestGet}from '../functions/api/region.js';
addTranslations(copy);
test('IP region maps mainland, HK, Macao and Taiwan to Chinese; others to English',()=>{
 for(const country of ['CN','HK','MO','TW','cn'])assert.equal(languageForCountry(country),'zh');
 for(const country of ['US','JP','CA','GB'])assert.equal(languageForCountry(country),'en');
 assert.equal(languageForBrowser(['zh-Hant']),'zh');assert.equal(languageForBrowser(['en-US']),'en');
});
test('English station labels and live duration/count text retain exact train numbers',()=>{
 registerStationNames([{name:'北京南'},{name:'重庆北'}]);
 assert.equal(translateText('北京南'),'Beijing South');assert.equal(translateText('重庆北'),'Chongqing North');
 assert.equal(translateText('已行走 25：20'),'Elapsed 25:20');
 assert.equal(translateText('12 趟直达车次'),'12 direct trains');
 assert.equal(translateText('Z138 · 28 个区间为 OSM 推算经由'),'Z138 · 28 OSM-inferred sections');
});
test('DOM translations restore Chinese and handle async updates without replacing controls',async()=>{
 const {document,MutationObserver}=parseHTML('<html><body><main><button aria-label="交换始发站和目的地">选择始发站</button><span>12 趟直达车次</span></main></body></html>');
 globalThis.MutationObserver=MutationObserver;
 const root=document.querySelector('main'),button=root.querySelector('button'),span=root.querySelector('span');
 const translator=createTranslator(root);translator.setLanguage('en');
 assert.equal(button.textContent,'Choose departure');assert.equal(button.getAttribute('aria-label'),'Swap departure and destination');
 span.textContent='23 趟直达车次';await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(span.textContent,'23 direct trains');
 translator.setLanguage('zh');assert.equal(button.textContent,'选择始发站');assert.equal(span.textContent,'23 趟直达车次');
 assert.equal(root.querySelector('button'),button);translator.disconnect();delete globalThis.MutationObserver;
});
test('region endpoint is private and emits only country, never the IP',async()=>{
 const response=onRequestGet({request:{cf:{country:'TW'},headers:new Headers({'CF-Connecting-IP':'192.0.2.1'})}});
 assert.deepEqual(await response.json(),{country:'TW'});assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await onRequestGet({request:{cf:{country:'XX'}}}).json(),{country:null});
});
test('country detection falls back from unavailable API to trace, and handles total failure',async()=>{
 const seen=[];assert.equal(await detectCountry(async url=>{seen.push(url);return new Response(url==='/api/region'?'<html>static host</html>':'loc=HK\nip=192.0.2.1\n');}),'HK');
 assert.deepEqual(seen,['/api/region','/cdn-cgi/trace']);
 assert.equal(await detectCountry(async()=>{throw Error('offline');}),null);
});
test('overnight arrival/departure pairs translate both dates',()=>{
 assert.equal(translateText('次日 01:05 / 次日 01:15'),'01:05+1 / 01:15+1');
});
test('initial interface copy has no untranslated Chinese text in English mode',async()=>{
 const fs=await import('node:fs');
 const source=fs.readFileSync(new URL('./main.js',import.meta.url),'utf8');
 const html=source.match(/document.querySelector\('#app'\).innerHTML=`([\s\S]*?)`;/)[1].replace(/\$\{icon\('[^']+'\)\}/g,'');
 const {document,MutationObserver}=parseHTML('<html><body>'+html+'</body></html>');globalThis.MutationObserver=MutationObserver;
 const translator=createTranslator(document.body);translator.setLanguage('en');
 const walker=document.createTreeWalker(document.body,4);let node;
 while((node=walker.nextNode()))assert.equal(/[\u3400-\u9fff]/u.test(node.nodeValue),false,node.nodeValue);
 translator.disconnect();delete globalThis.MutationObserver;
});

test('train summary abbreviates departure and arrival without widening overnight times',()=>{
 assert.equal(translateText('21:25 出发 · 06:53+1 到达'),'21:25 dep · 06:53+1 arr');
});
