// Hand-drawn SVG charts (docs/GAMEPLAY_V2.md §14.4). No dependency, no store, no engine: data and colours come in as
// props (scale.test.ts checks the imports).
export { BarChart, type BarDef, type BarGroup } from './BarChart'
export { LineChart, reducedMotion, useWidth, type ChartMark, type LinePoint, type LineSeries, type TargetLine } from './LineChart'
export { LockedTile } from './LockedTile'
export { PieChart } from './PieChart'
export { RadarChart } from './RadarChart'
export { arcPath, foldSmall, linear, niceTicks, polar, stackParts } from './scale'
