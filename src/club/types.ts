import { k as __i18n_k } from '../i18n/index';
/* Club identity: parent company and home stadium. Together with the market they set the difficulty
   of an expansion start (ROADMAP.md, 난이도 설계). Only labels live here for now; money and
   attendance effects arrive with the budget (V0.3) and finance (V0.6) systems. */

export type ParentCompanyType = 'conglomerate' | 'midsize' | 'namingRights' | 'citizen';

export const PARENT_COMPANY_TYPES: Record<ParentCompanyType, { label: string; summary: string }> = {
  conglomerate: { label: __i18n_k("club.types.conglomerate.label.8e7ea182"), summary: __i18n_k("club.types.conglomerate.summary.642c1593") },
  midsize: { label: __i18n_k("club.types.midsize.label.04c7de11"), summary: __i18n_k("club.types.midsize.summary.8d4ce66e") },
  namingRights: { label: __i18n_k("club.types.namingRights.label.2d7807db"), summary: __i18n_k("club.types.namingRights.summary.dbac550d") },
  citizen: { label: __i18n_k("club.types.citizen.label.6de78da7"), summary: __i18n_k("club.types.citizen.summary.9bed5af9") },
};

export type StadiumSize = 'small' | 'medium' | 'large' | 'dome';

export const STADIUM_SIZES: Record<StadiumSize, { label: string; capacity: [number, number] }> = {
  small: { label: __i18n_k("club.types.small.label.debe3cf8"), capacity: [7000, 10000] },
  medium: { label: __i18n_k("club.types.medium.label.864f343c"), capacity: [12000, 17000] },
  large: { label: __i18n_k("club.types.large.label.0ddc98aa"), capacity: [20000, 25000] },
  dome: { label: __i18n_k("club.types.dome.label.901441b3"), capacity: [15000, 20000] },
};

export type StadiumOwnership = 'municipalLease' | 'longTermOperation';

export const STADIUM_OWNERSHIP: Record<StadiumOwnership, { label: string }> = {
  municipalLease: { label: __i18n_k("club.types.municipalLease.label.3446f47b") },
  longTermOperation: { label: __i18n_k("club.types.longTermOperation.label.02a73cee") },
};
