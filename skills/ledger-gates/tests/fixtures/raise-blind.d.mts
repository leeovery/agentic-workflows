import type { Gate } from '../../hooks/layout.ts'

declare const payload: Omit<Gate, 'name'> & { gate: string }

export default payload
