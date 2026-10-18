import type {Language} from '@api/index';
import {formatNumber} from '../../../shared/format-number';
import type {HoleInspection} from '../inspect-hole';
import type {SelectedHoleView} from './selected-hole.component';

/** `inspection` with its numbers formatted for `language`. */
export function selectedHoleView(inspection: HoleInspection, language: Language): SelectedHoleView {
  const number = (value: number): string => formatNumber(value, language);
  return {
    ...inspection,
    rowText: number(inspection.row),
    fromText: number(inspection.fromColumn),
    toText: number(inspection.toColumn),
    lengthColumnsText: number(inspection.lengthColumns),
    lengthMmText: number(inspection.lengthMm),
    gapColumnsText: number(inspection.gap.columns),
    gapMmText: number(inspection.gap.mm),
    warnings: inspection.warnings.map((warning) => ({
      kind: warning.kind,
      mmText: number(warning.mm),
      minimumText: number(warning.minimumMm),
    })),
  };
}
