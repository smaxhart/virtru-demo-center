// Furniture for the desktop scene: who has which email address, what time it is, and the ordinary
// mail and chat that sit around the one message that matters. Nothing here touches the key server.

import { EXTERNAL } from './scmData.js'

const DOMAIN = {
  Edgewing: 'edgewing.example',
  'Edgewing IT': 'edgewing.example',
  GIGO: 'gigo.example',
  'Mitsubishi Heavy Industries': 'mhi.example',
  'BAE Systems': 'baesystems.example',
  Leonardo: 'leonardo.example',
  'Tier-2 supplier': 'precisionforge.example',
  'Tier-3 supplier': 'northgate-machining.example',
  'A competing prime': 'rival-prime.example',
}

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '')

export const emailOf = (p) => {
  if (!p) return ''
  if (p.id === 'gmail') return EXTERNAL.name
  const [f, ...rest] = p.name.split(' ')
  return `${slug(f)}.${slug(rest.join(''))}@${DOMAIN[p.employer] ?? 'gigo.example'}`
}

/** The watermark's `${username}`: first initial and surname, the way a directory would. */
export const usernameOf = (p) => {
  if (!p) return ''
  if (p.id === 'gmail') return 'rmercer'
  const [f, ...rest] = p.name.split(' ')
  return `${slug(f)[0]}${slug(rest.join(''))}`
}

// ── The clock: the scene starts at 09:41 on Wednesday 7 October and runs forward in real minutes ──

const BASE = 9 * 60 + 41
const pad = (n) => String(n).padStart(2, '0')
export const minutesNow = (S) => BASE + Math.floor((Date.now() - S.t0) / 60000)
export const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`
export const stampNow = (S) => hhmm(minutesNow(S))
export const TODAY_UK = '07/10/2026'

// ── Ordinary mail ─────────────────────────────────────────────────────────────

const OFFICE = { name: 'GIGO Document Control', email: 'doc-control@gigo.example', color: '#475569' }
const PMO = { name: 'Programme office', email: 'programme.office@gigo.example', color: '#0e7490' }

/** Mail already in a person's mailbox when the day starts. `who` is the sender, shown the way Outlook shows it. */
export function seedInbox(p) {
  return [
    { id: `s1-${p.id}`, seed: true, who: OFFICE, subject: 'Weekly digest: 6 change requests awaiting review', at: '08:12', day: 'Today', docs: [], read: false,
      body: ['Six change requests are awaiting review in Meridian SCM this week.', 'Open the Changes list to see the ones assigned to you.'] },
    { id: `s2-${p.id}`, seed: true, who: PMO, subject: 'Change board: Thursday 10:00', at: 'Tue 17:02', day: 'Yesterday', docs: [], read: true,
      body: ['The change board meets on Thursday at 10:00.', 'Please have review comments entered before then. Papers go out the evening before.'] },
  ]
}

export function seedSent(p) {
  return [
    { id: `t1-${p.id}`, seed: true, who: p, toName: 'Programme office', toAddr: PMO.email, subject: 'Re: Change board: Thursday 10:00', at: 'Tue 17:20', day: 'Yesterday', docs: [], read: true,
      body: ['Noted, thank you. I will have my comments in before Thursday.'] },
  ]
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export const CHANNELS = [
  { id: 'general', name: 'General' },
  { id: 'integration', name: 'Integration' },
  { id: 'propulsion', name: 'Propulsion' },
  { id: 'sensors', name: 'Sensors interfaces' },
  { id: 'supply', name: 'Supply chain' },
]

/** Messages already in the channel. `from` is a persona id; `day` groups them. */
export function seedChat() {
  return [
    { id: 'c1', ch: 'integration', from: 'gcap-priya', day: 'Yesterday', at: '16:40', text: 'Draft of the mounting pattern change is on CR-4471. Comments by Thursday please.', docs: [], likes: 2 },
    { id: 'c2', ch: 'integration', from: 'gcap-kenji', day: 'Yesterday', at: '17:05', text: 'Thermal loop numbers look right on our side. I will confirm after the next test run.', docs: [], likes: 1 },
    { id: 'c3', ch: 'integration', from: 'gcap-oliver', day: 'Yesterday', at: '17:31', text: 'The drawdown slips a month if the baseline is not signed off by Friday.', docs: [], likes: 0 },
    { id: 'c4', ch: 'integration', from: 'gcap-harriet', day: 'Today', at: '08:52', text: 'Reminder: anything marked GCAP SECRET goes out as a protected file. Nothing in clear, please, even in here.', docs: [], likes: 4 },
    { id: 'c5', ch: 'supply', from: 'gcap-giulia', day: 'Today', at: '08:15', text: 'PO-88250 delivery date confirmed with the supplier. Updated in Meridian.', docs: [], likes: 1 },
    { id: 'c6', ch: 'propulsion', from: 'gcap-kenji', day: 'Yesterday', at: '14:02', text: 'Test cell is booked Monday to Wednesday next week.', docs: [], likes: 0 },
  ]
}
