import type { View } from '../../hooks/model.ts'

export declare const approval: (text: string) => { kind: string; id: string; text: string; page: string | null }

export declare const mapTopic: (title: string, summary: string) => { topic: string; title: string; summary: string }

declare const view: View

export default view
