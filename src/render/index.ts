// Render lane barrel (optional convenience; entry points live in their own files per CONTRACTS §5).
export { GameCanvas, type GameCanvasProps } from './GameCanvas'
export { ObjectPreview, type ObjectPreviewProps } from './ObjectPreview'
export type { BubbleRenderer, WorldBubble } from './bubbles'
export { BubbleAnchor, type BubbleAnchorProps } from './BubbleAnchor'
export { DefaultBubble } from './WorldBubbles'
export { createMockState } from './mockState'
export * from './palette'
