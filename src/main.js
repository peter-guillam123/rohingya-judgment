import { initNav, initTimeline, initExplorer, initVotes } from './ui.js';
import { initStage } from './stage.js';

initNav();
initTimeline();
initVotes();

const json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });

Promise.all([json('data/map.json'), json('data/geo.json')])
  .then(([map, geo]) => {
    initExplorer(map, geo);
    try {
      initStage(map, geo);
    } catch (e) {
      console.warn('The drawing could not start:', e);
      document.documentElement.classList.add('no-gl');
    }
  })
  .catch((e) => {
    console.warn('Map data could not be loaded:', e);
    document.documentElement.classList.add('no-gl');
    initExplorer(null, null);
  });
