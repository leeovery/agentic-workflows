import type { View } from '../../hooks/model.ts'

export declare const decision: (who: 'yours' | 'claude' | 'carried', ...texts: string[]) => { id: string; text: string; who: string }[]

declare const view: View

export default view
