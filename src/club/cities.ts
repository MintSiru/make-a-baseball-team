import { k as __i18n_k } from '../i18n/index';
/* Candidate homes for the expansion club. Population is the 2022-11 resident count (Korean Wikipedia
   city list), stadium seats are real (docs/RULES.md §10), and the cities are the ones actually
   bidding for an 11th club or a futures club in 2026 (RULES.md §12). `market` (0–100) and
   `competition` are the game's own estimates of catchment and nearby clubs. */

import { NORTH_CITIES } from '../league/north';

export interface City {
  id: string;
  name: string;
  province: string;
  population: number;
  /** Existing stadium the club can use at once; `null` seats means a temporary ground (game assumption). */
  stadium: { name: string; seats: number; real: boolean };
  market: number;
  competition: string;
  note: string;
}

export const CITIES: City[] = [
  { id: 'ulsan', name: __i18n_k("club.cities.cITIES.name.b90ae636"), province: __i18n_k("club.cities.cITIES.province.79012109"), population: 1_135_423, stadium: { name: __i18n_k("club.cities.stadium.name.24eecbac"), seats: 12_088, real: true }, market: 80, competition: __i18n_k("club.cities.cITIES.competition.9c9f532b"), note: __i18n_k("club.cities.cITIES.note.565c5305") },
  { id: 'goyang', name: __i18n_k("club.cities.cITIES.name.c7311e99"), province: __i18n_k("club.cities.cITIES.province.bfcc2516"), population: 1_045_497, stadium: { name: __i18n_k("club.cities.stadium.name.480bf942"), seats: 7_000, real: false }, market: 72, competition: __i18n_k("club.cities.cITIES.competition.6c15cd8c"), note: __i18n_k("club.cities.cITIES.note.6a3cb708") },
  { id: 'cheongju', name: __i18n_k("club.cities.cITIES.name.d2f21306"), province: __i18n_k("club.cities.cITIES.province.49414766"), population: 855_326, stadium: { name: __i18n_k("club.cities.stadium.name.cc718f86"), seats: 10_500, real: true }, market: 70, competition: __i18n_k("club.cities.cITIES.competition.e42ba227"), note: __i18n_k("club.cities.cITIES.note.436f89d8") },
  { id: 'seongnam', name: __i18n_k("club.cities.cITIES.name.a227ab1c"), province: __i18n_k("club.cities.cITIES.province.bfcc2516"), population: 922_025, stadium: { name: __i18n_k("club.cities.stadium.name.2631094a"), seats: 7_000, real: false }, market: 66, competition: __i18n_k("club.cities.cITIES.competition.f9d3c840"), note: __i18n_k("club.cities.cITIES.note.fa3e93ed") },
  { id: 'jeonju', name: __i18n_k("club.cities.cITIES.name.64ada749"), province: __i18n_k("club.cities.cITIES.province.59b03450"), population: 666_517, stadium: { name: __i18n_k("club.cities.stadium.name.2e5ca709"), seats: 7_000, real: false }, market: 64, competition: __i18n_k("club.cities.cITIES.competition.a67db996"), note: __i18n_k("club.cities.cITIES.note.8d51bb3f") },
  { id: 'hwaseong', name: __i18n_k("club.cities.cITIES.name.2644d147"), province: __i18n_k("club.cities.cITIES.province.bfcc2516"), population: 880_859, stadium: { name: __i18n_k("club.cities.stadium.name.0954f211"), seats: 7_000, real: false }, market: 60, competition: __i18n_k("club.cities.cITIES.competition.570829c0"), note: __i18n_k("club.cities.cITIES.note.9487efc3") },
  { id: 'cheonan', name: __i18n_k("club.cities.cITIES.name.ffee1233"), province: __i18n_k("club.cities.cITIES.province.2d0a6a6a"), population: 682_199, stadium: { name: __i18n_k("club.cities.stadium.name.62a0dac8"), seats: 7_000, real: false }, market: 56, competition: __i18n_k("club.cities.cITIES.competition.3d5399d0"), note: __i18n_k("club.cities.cITIES.note.4f2c773e") },
  { id: 'pohang', name: __i18n_k("club.cities.cITIES.name.a8164928"), province: __i18n_k("club.cities.cITIES.province.e6011691"), population: 501_109, stadium: { name: __i18n_k("club.cities.stadium.name.ce74fe8c"), seats: 12_247, real: true }, market: 46, competition: __i18n_k("club.cities.cITIES.competition.c1a0eea4"), note: '' },
  { id: 'jeju', name: __i18n_k("club.cities.cITIES.name.b6966f66"), province: __i18n_k("club.cities.cITIES.province.44239ae2"), population: 492_306, stadium: { name: __i18n_k("club.cities.stadium.name.3ab3ff2d"), seats: 8_500, real: true }, market: 42, competition: __i18n_k("club.cities.cITIES.competition.639792bc"), note: '' },
  { id: 'gunsan', name: __i18n_k("club.cities.cITIES.name.013f3691"), province: __i18n_k("club.cities.cITIES.province.59b03450"), population: 269_023, stadium: { name: __i18n_k("club.cities.stadium.name.5e1d70b7"), seats: 11_000, real: true }, market: 34, competition: __i18n_k("club.cities.cITIES.competition.6c7e3cd1"), note: __i18n_k("club.cities.cITIES.note.3874e6c6") },
  { id: 'chuncheon', name: __i18n_k("club.cities.cITIES.name.da0de687"), province: __i18n_k("club.cities.cITIES.province.728d9f63"), population: 284_645, stadium: { name: __i18n_k("club.cities.stadium.name.8f589253"), seats: 8_160, real: true }, market: 32, competition: __i18n_k("club.cities.cITIES.competition.107dab74"), note: '' },
  // 1.7.0 (from the 1.6 feedback): more homes. Populations rounded to the thousand (2022); none of these has a
  // ballpark a KBO club could use, so each starts at a temporary ground, and their bids are game assumptions.
  { id: 'yongin', name: __i18n_k("club.cities.text.1c0fc803"), province: __i18n_k("club.cities.text.bfcc2516"), population: 1_076_000, stadium: { name: __i18n_k("club.cities.text.481cebaf"), seats: 7_000, real: false }, market: 62, competition: __i18n_k("club.cities.text.4d947560"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'bucheon', name: __i18n_k("club.cities.text.894682d9"), province: __i18n_k("club.cities.text.bfcc2516"), population: 791_000, stadium: { name: __i18n_k("club.cities.text.747482fc"), seats: 7_000, real: false }, market: 58, competition: __i18n_k("club.cities.text.699a2777"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'pyeongtaek', name: __i18n_k("club.cities.text.f560dc60"), province: __i18n_k("club.cities.text.bfcc2516"), population: 580_000, stadium: { name: __i18n_k("club.cities.text.d8058abf"), seats: 7_000, real: false }, market: 50, competition: __i18n_k("club.cities.text.570829c0"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'gimhae', name: __i18n_k("club.cities.text.435a8215"), province: __i18n_k("club.cities.text.a1097f3c"), population: 535_000, stadium: { name: __i18n_k("club.cities.text.00bce46f"), seats: 7_000, real: false }, market: 48, competition: __i18n_k("club.cities.text.06c4d0ac"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'sejong', name: __i18n_k("club.cities.text.210a875a"), province: __i18n_k("club.cities.text.2fbe3086"), population: 386_000, stadium: { name: __i18n_k("club.cities.text.b15e94a7"), seats: 7_000, real: false }, market: 44, competition: __i18n_k("club.cities.text.3d5399d0"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'wonju', name: __i18n_k("club.cities.text.25f70fc3"), province: __i18n_k("club.cities.text.728d9f63"), population: 361_000, stadium: { name: __i18n_k("club.cities.text.8ec95401"), seats: 7_000, real: false }, market: 36, competition: __i18n_k("club.cities.text.88946298"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'jinju', name: __i18n_k("club.cities.text.c446c4c9"), province: __i18n_k("club.cities.text.a1097f3c"), population: 342_000, stadium: { name: __i18n_k("club.cities.text.d4b3a794"), seats: 7_000, real: false }, market: 30, competition: __i18n_k("club.cities.text.f2e9a2ee"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'yeosu', name: __i18n_k("club.cities.text.5ba7ff76"), province: __i18n_k("club.cities.text.99e45246"), population: 275_000, stadium: { name: __i18n_k("club.cities.text.52bc45da"), seats: 7_000, real: false }, market: 28, competition: __i18n_k("club.cities.text.92199e8b"), note: __i18n_k("club.cities.text.87d1086a") },
  { id: 'gyeongju', name: __i18n_k("club.cities.text.1bd9ee29"), province: __i18n_k("club.cities.text.e6011691"), population: 250_000, stadium: { name: __i18n_k("club.cities.text.58239ebd"), seats: 7_000, real: false }, market: 26, competition: __i18n_k("club.cities.text.a88c175a"), note: __i18n_k("club.cities.text.87d1086a") },
];

/** 1.6.0: homes only a scenario starts in (scenarios.ts). */
export const SCENARIO_CITIES: City[] = [
  // 1.8.1, 돌아온 탕아: 문학, left empty when SSG moved to its 청라 dome (game fiction).
  { id: 'incheon', name: __i18n_k("club.cities.text.41402f7e"), province: __i18n_k("club.cities.text.4f20da2a"), population: 3_020_000, stadium: { name: __i18n_k("club.cities.text.563ff67e"), seats: 23_000, real: true }, market: 72, competition: __i18n_k("club.cities.text.7853d34f"), note: __i18n_k("club.cities.text.ce29a185") },
  { id: 'seoul', name: __i18n_k("club.cities.sCENARIO_CITIES.name.ea9858ee"), province: __i18n_k("club.cities.sCENARIO_CITIES.province.3964bd52"), population: 9_386_034, stadium: { name: __i18n_k("club.cities.stadium.name.5a4b31e1"), seats: 10_500, real: false }, market: 78, competition: __i18n_k("club.cities.sCENARIO_CITIES.competition.7a0da299"), note: __i18n_k("club.cities.sCENARIO_CITIES.note.44d6c238") },
  { id: 'ulleung', name: __i18n_k("club.cities.sCENARIO_CITIES.name.e2971049"), province: __i18n_k("club.cities.sCENARIO_CITIES.province.9c479e8f"), population: 9_000, stadium: { name: __i18n_k("club.cities.stadium.name.cc8463f9"), seats: 3_000, real: false }, market: 4, competition: __i18n_k("club.cities.sCENARIO_CITIES.competition.f5759ff0"), note: __i18n_k("club.cities.sCENARIO_CITIES.note.e55b2828") },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id) ?? SCENARIO_CITIES.find((c) => c.id === id) ?? NORTH_CITIES.find((c) => c.id === id);
