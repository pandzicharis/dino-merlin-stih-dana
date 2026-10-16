/**
 * Loader — crni ekran s potpisom i Magazom, kad korisnik čeka.
 *
 * Prvi sloj: CSS i skripta idu inline u <head> (layout), a sam ekran je prvi
 * element u <body> (components/AppLoader) — postoji od prvog bajta, prije
 * globals.css i prije JS-a aplikacije.
 *
 * Pojavi se tek kad učitavanje kasni (DELAY) i ne stoji duže od MAX; kad se
 * jednom pokaže, ostane bar MIN da ne trepne. Gasi ga aplikacija kad je
 * stranica spremna (AppLoader), a ako JS ne stigne — sam istekne.
 *
 * SAMO na živoj aplikaciji. Podrazumijevano je skriven, a skripta ga uključi
 * tek kad: nije u iframeu (telefon u prezentaciji, pregled u adminu), nije
 * /prezentacija, /admin, /pregled ni /dev, i nije Chrome bez prozora ili
 * automatizovan preglednik (snimanje videa i slika za slajdove).
 */

const DELAY = 300
const MIN = 800
const MAX = 1800

/** putanje na kojima loadera nikad nema */
const OFF = '^\\/(prezentacija|admin|pregled|dev)(\\/|$)'

export const LOADER_CSS =
  '#app-loader{display:none}' +
  `html[data-loading] #app-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#000;animation:ld-in .35s ease-out ${DELAY}ms both}` +
  '.ld-lockup{display:flex;align-items:center;gap:20px;animation:ld-breathe 1.8s ease-in-out 1.3s infinite}' +
  '.ld-sig{display:block;height:50px;width:auto;opacity:.9;clip-path:inset(0 100% 0 0);animation:ld-sign .75s cubic-bezier(.33,0,.2,1) .3s forwards}' +
  '.ld-bar{width:1px;height:34px;background:rgba(255,255,255,.2);transform:scaleY(0);animation:ld-grow .45s ease-out .6s forwards}' +
  '.ld-mag{display:block;opacity:0;transform:translateY(5px);animation:ld-rise .55s ease-out .72s forwards}' +
  '@keyframes ld-in{from{opacity:0}to{opacity:1}}' +
  '@keyframes ld-sign{to{clip-path:inset(0 0 0 0)}}' +
  '@keyframes ld-grow{to{transform:scaleY(1)}}' +
  '@keyframes ld-rise{to{opacity:.9;transform:translateY(2px)}}' +
  '@keyframes ld-breathe{50%{opacity:.55}}' +
  '@media (prefers-reduced-motion:reduce){#app-loader .ld-lockup,#app-loader .ld-lockup>*{animation:none;clip-path:none;transform:none;opacity:.9}}'

/**
 * window.__stihLoader: show() (prelaz na drugu stranicu) i hide() (stranica
 * spremna). Ne postoji tamo gdje loadera ne smije biti — tad ga niko ne zove.
 */
export const LOADER_SCRIPT = `(function(){try{
var d=document.documentElement,off=new RegExp('${OFF}'),n=navigator;
if(self!==top||off.test(location.pathname)||n.webdriver||/Headless/.test(n.userAgent))return;
var t0=0,cap,fade,out=0;
function el(){return document.getElementById('app-loader')}
function reset(e){out=0;clearTimeout(fade);if(e){e.style.animation='';e.style.opacity='';e.style.transition=''}}
function end(){reset(el());d.removeAttribute('data-loading')}
var L=window.__stihLoader={
live:function(p){return !off.test(p)},
show:function(){clearTimeout(cap);var e=el();reset(e);d.removeAttribute('data-loading');if(e)void e.offsetWidth;d.setAttribute('data-loading','');t0=Date.now();cap=setTimeout(L.hide,${DELAY + MAX})},
hide:function(){clearTimeout(cap);if(out||!d.hasAttribute('data-loading'))return;
var e=el(),o=e?+getComputedStyle(e).opacity:0;if(o<.01)return end();
out=1;fade=setTimeout(function(){e.style.opacity=getComputedStyle(e).opacity;e.style.animation='none';void e.offsetWidth;e.style.transition='opacity .4s ease';e.style.opacity='0';fade=setTimeout(end,400)},o<.5?0:Math.max(0,${DELAY + MIN}-(Date.now()-t0)))}
};
L.show();
addEventListener('pageshow',function(e){if(e.persisted)L.hide()});
}catch(e){}})()`
