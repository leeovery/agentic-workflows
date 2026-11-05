import type { View } from '../../hooks/model.ts'

export declare const specSection: (number: number, title: string, ...changed: number[]) => object

export declare const readPass: (pass: number, found: number, calls: number, yours: number) => object

export declare const cutPhase: (at: number, name: string, scenarios: number, ...sections: number[]) => object

declare const view: View

export default view
