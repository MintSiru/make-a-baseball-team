import { k as __i18n_k } from '../i18n/index';
/* 1.9.9 (the user's request): the landmark a home city's fans name their stars after — 「무등산 폭격기」 (선동열, 광주),
   「자갈치」 (김민호, 부산). One a city (its mountain, river, sea or best-known symbol); a city not in the list is
   called by its own name. Used by nicknames.ts. */

const LANDMARKS: Record<string, () => string> = {
  서울: () => __i18n_k("league.landmarks.text.ec16a428"),
  부산: () => __i18n_k("league.landmarks.text.d58a48eb"),
  대구: () => __i18n_k("league.landmarks.text.46473de7"),
  광주: () => __i18n_k("league.landmarks.text.4a2630e0"),
  대전: () => __i18n_k("league.landmarks.text.fd575ad1"),
  인천: () => __i18n_k("league.landmarks.text.f71456be"),
  수원: () => __i18n_k("league.landmarks.text.83f76b82"),
  창원: () => __i18n_k("league.landmarks.text.82af90c1"),
  전주: () => __i18n_k("league.landmarks.text.d72b8715"),
  울산: () => __i18n_k("league.landmarks.text.872e638f"),
  청주: () => __i18n_k("league.landmarks.text.60acd462"),
  성남: () => __i18n_k("league.landmarks.text.17ca79e8"),
  포항: () => __i18n_k("league.landmarks.text.154d2570"),
  제주: () => __i18n_k("league.landmarks.text.1a255c10"),
  군산: () => __i18n_k("league.landmarks.text.b9237400"),
  춘천: () => __i18n_k("league.landmarks.text.21cf870b"),
  원주: () => __i18n_k("league.landmarks.text.2ceef048"),
  진주: () => __i18n_k("league.landmarks.text.41ab1b40"),
  여수: () => __i18n_k("league.landmarks.text.f7148a73"),
  경주: () => __i18n_k("league.landmarks.text.1cf5b825"),
  김해: () => __i18n_k("league.landmarks.text.29617a64"),
  울릉: () => __i18n_k("league.landmarks.text.478d9894"),
  평양: () => __i18n_k("league.landmarks.text.c53cccf4"),
  개성: () => __i18n_k("league.landmarks.text.a60d7562"),
  원산: () => __i18n_k("league.landmarks.text.9266701c"),
  신의주: () => __i18n_k("league.landmarks.text.d99ab5e0"),
  청진: () => __i18n_k("league.landmarks.text.4bee6449"),
  함흥: () => __i18n_k("league.landmarks.text.afe2ac39"),
  사리원: () => __i18n_k("league.landmarks.text.a70b1492"),
};

/** The landmark of `city` (a Korean city name as the game keeps it, or a region like "대구·경북": its first part). */
export function landmarkOf(city: string): string {
  const name = city.split('·')[0]!.trim();
  return LANDMARKS[name]?.() ?? name;
}
