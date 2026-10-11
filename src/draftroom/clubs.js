import { k as __i18n_k } from '../i18n/index.js';
/* The ten KBO clubs. Club names are real; every rating and record here is fictional.
   `rank` is the fictional previous-season finish and sets the draft order (worst first).
   `needs` lists the three priority positions, most urgent first. */
// Ported from KBO-Draft-Room df4faad src/core/clubs.js. See docs/UPSTREAM.md.

// prettier-ignore
const TEAMS = [
  {id: 'kiwoom', name: __i18n_k("draftroom.clubs.tEAMS.name.b096e371"), short: __i18n_k("draftroom.clubs.tEAMS.short.def4ac54"), color: '#821734', rank: 10, region: __i18n_k("draftroom.clubs.tEAMS.region.ea9858ee"), needs: ['SP', 'C', 'OF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.677867b6"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.407416c7"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.4b2c9451"), record: __i18n_k("draftroom.clubs.tEAMS.record.1da8953b")},
  {id: 'nc', name: __i18n_k("draftroom.clubs.tEAMS.name.6e9552f9"), short: 'NC', color: '#255581', rank: 9, region: __i18n_k("draftroom.clubs.tEAMS.region.7aeadd5c"), needs: ['RP', 'IF', 'SP'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.91a54fae"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.a3d5b2d6"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.113471b3"), record: __i18n_k("draftroom.clubs.tEAMS.record.987aafb6")},
  {id: 'hanwha', name: __i18n_k("draftroom.clubs.tEAMS.name.68d9f56e"), short: __i18n_k("draftroom.clubs.tEAMS.short.f67e4351"), color: '#d9541f', rank: 8, region: '대전·충청·전북', needs: ['OF', 'C', 'IF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.e299a152"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.a613eb5d"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.8bfc693d"), record: __i18n_k("draftroom.clubs.tEAMS.record.684e8ccf")},
  {id: 'lotte', name: __i18n_k("draftroom.clubs.tEAMS.name.6ebc8480"), short: __i18n_k("draftroom.clubs.tEAMS.short.9625876c"), color: '#bf293d', rank: 7, region: '부산·울산', needs: ['SP', 'RP', 'C'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.3daa9047"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.f39fbfea"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.b5c6e0d0"), record: __i18n_k("draftroom.clubs.tEAMS.record.8b65f782")},
  {id: 'ssg', name: __i18n_k("draftroom.clubs.tEAMS.name.58c49993"), short: 'SSG', color: '#b8243a', rank: 6, region: __i18n_k("draftroom.clubs.tEAMS.region.41402f7e"), needs: ['IF', 'SP', 'OF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.5bc2058d"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.dd1ceb55"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.9a0079c7"), record: __i18n_k("draftroom.clubs.tEAMS.record.50394a02")},
  {id: 'kt', name: __i18n_k("draftroom.clubs.tEAMS.name.5ea849ea"), short: 'KT', color: '#343b48', rank: 5, region: '경기·강원', needs: ['C', 'RP', 'OF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.23d4667f"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.7f9e23a1"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.a8e7866b"), record: __i18n_k("draftroom.clubs.tEAMS.record.9149e207")},
  {id: 'doosan', name: __i18n_k("draftroom.clubs.tEAMS.name.0b110249"), short: __i18n_k("draftroom.clubs.tEAMS.short.ca26415b"), color: '#243556', rank: 4, region: __i18n_k("draftroom.clubs.tEAMS.region.ea9858ee"), needs: ['SP', 'IF', 'RP'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.b1eccade"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.752c83ab"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.daae66c3"), record: __i18n_k("draftroom.clubs.tEAMS.record.0bfc497c")},
  {id: 'lg', name: __i18n_k("draftroom.clubs.tEAMS.name.8bfa0c03"), short: 'LG', color: '#a51f4f', rank: 3, region: __i18n_k("draftroom.clubs.tEAMS.region.ea9858ee"), needs: ['RP', 'C', 'SP'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.3a35d491"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.45761954"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.044c7de1"), record: __i18n_k("draftroom.clubs.tEAMS.record.306e81df")},
  {id: 'samsung', name: __i18n_k("draftroom.clubs.tEAMS.name.ebfb77ab"), short: __i18n_k("draftroom.clubs.tEAMS.short.1d9554f4"), color: '#2865b7', rank: 2, region: '대구·경북', needs: ['RP', 'OF', 'IF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.e358b279"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.e0c002b1"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.480723fe"), record: __i18n_k("draftroom.clubs.tEAMS.record.126fe6f6")},
  {id: 'kia', name: __i18n_k("draftroom.clubs.tEAMS.name.b97606a8"), short: 'KIA', color: '#b52a3e', rank: 1, region: '광주·전남·제주', needs: ['C', 'SP', 'IF'],
    strong: __i18n_k("draftroom.clubs.tEAMS.strong.32c02de0"), weak: __i18n_k("draftroom.clubs.tEAMS.weak.eed2e64e"), goal: __i18n_k("draftroom.clubs.tEAMS.goal.837d8760"), record: __i18n_k("draftroom.clubs.tEAMS.record.79342b48")},
];
export default TEAMS;
