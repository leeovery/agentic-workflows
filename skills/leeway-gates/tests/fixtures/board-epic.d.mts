import type { View } from '../../hooks/model.ts'

export type Topic = { topic: string; title: string; state: string; decided: number; total: number; session: string | null; messages: number; experiment: { id: string; running: boolean } | null }

export declare const epicTopic: (title: string, state: string, more?: Partial<Topic>) => Topic

export declare const decidedTopics: (...titles: string[]) => Topic[]

declare const view: View

export default view
