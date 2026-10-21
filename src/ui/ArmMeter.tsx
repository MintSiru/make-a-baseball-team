import { t as __i18n_t } from '../i18n/index';
/* 2.0.34 (the user's request: a pitcher's tiredness at a glance): how ready an arm is, as a small bar with a word —
   ready, a little tired, or resting and until when (manager.ts armReady). */
import type { ArmReady } from '../league/manager';

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

export function ArmMeter({ arm }: { arm: ArmReady }) {
  const tone = !arm.ready ? 'rest' : arm.pct < 100 ? 'tired' : 'ready';
  const label =
    arm.why === 'hurt'
      ? __i18n_t("ui.armMeter.text.501fb802")
      : arm.ready
        ? arm.pct < 100
          ? __i18n_t("ui.armMeter.text.601d9ab2")
          : __i18n_t("ui.armMeter.text.93c33257")
        : arm.why === 'today'
          ? __i18n_t("ui.armMeter.text.4e9d4195")
          : arm.why === 'streak'
            ? __i18n_t("ui.armMeter.text.8358e785", { n: arm.last?.streak ?? 2 })
            : arm.why === 'short'
              ? __i18n_t("ui.armMeter.text.3db1851c")
              : __i18n_t("ui.armMeter.text.a51d3d21", { n: arm.last?.pitches ?? 0 });
  const back = !arm.ready && arm.back ? __i18n_t("ui.armMeter.text.ddc7337b", { date: md(arm.back) }) : '';
  const last = arm.last ? __i18n_t("ui.armMeter.text.d3d1eead", { date: md(arm.last.date), n: arm.last.pitches }) + (arm.last.streak >= 2 ? __i18n_t("ui.armMeter.text.7f23def5", { n: arm.last.streak }) : '') : __i18n_t("ui.armMeter.text.b8954782");
  return (
    <span class={`arm-meter ${tone}`} title={last}>
      <span class="arm-bar" aria-hidden="true">
        <span style={{ width: `${arm.pct}%` }} />
      </span>
      <span class="arm-text">
        {arm.pct}% {label}
        {back}
      </span>
    </span>
  );
}
