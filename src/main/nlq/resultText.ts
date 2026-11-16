import type { NlqQueryResult } from '../../shared/nlq/constants';

export function describeResult(result: NlqQueryResult): string {
  const range = result.spec.period.from === result.spec.period.to
    ? result.spec.period.from
    : `${result.spec.period.from} 至 ${result.spec.period.to}`;
  if (result.rows.length === 0) return `${range}没有查到${result.metricLabel}的数据。`;
  const summary = result.spec.group_by?.length
    ? `${range}的${result.metricLabel}共查到 ${result.rows.length} 个分组${result.total === undefined ? '' : `，合计 ${result.total} ${result.unit}`}。`
    : `${range}的${result.metricLabel}为 ${result.total} ${result.unit}。`;
  if (!result.comparison) return summary;
  const label = result.spec.compare === 'prev_year' ? '同比' : '环比';
  const difference = result.comparison.difference;
  const differenceText = difference > 0
    ? `多 ${difference} ${result.unit}`
    : difference < 0 ? `少 ${Math.abs(difference)} ${result.unit}` : '持平';
  const change = result.comparison.changePercent === null
    ? '对比期为零，无法计算百分比'
    : difference === 0 ? `${label}持平`
      : `${label}${difference > 0 ? '增长' : '下降'} ${Math.abs(result.comparison.changePercent)}%`;
  return `${summary}对比期为 ${result.comparison.previous} ${result.unit}，${differenceText}，${change}。`;
}
