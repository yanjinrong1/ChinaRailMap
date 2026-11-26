import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp.js';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreGL from './vendor/maplibre-leaflet.js';
// Same-origin worker asset avoids blob-worker restrictions in hosted pages.
maplibregl.setWorkerUrl(workerUrl);
maplibregl.setWorkerCount(1);
export function createVectorLayer(style,attribution){
 // MapLibre 4 has no supported() export; Map construction reports WebGL errors.
 return maplibreGL({style,attribution,pane:'vectorBase',interactive:false,maxTileCacheSize:24,maxTileCacheZoomLevels:1,fadeDuration:0});
}
