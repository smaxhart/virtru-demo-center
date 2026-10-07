// Small pieces shared by the desktop apps: line icons, the TDF file glyph and the Windows message box.

export const Ico = ({ d, size = 16, sw = 1.3 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

export const ICONS = {
  mail: 'M3 5.5h14v9H3zM3.5 6l6.500 5 6.500-5',
  cal: 'M3.500 5h13v11h-13zM3.500 8.500h13M7 3v3M13 3v3',
  people: 'M7.500 9a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5ZM3 16c0-2.500 2-4 4.500-4S12 13.500 12 16M13.500 8a2 2 0 1 0 0-4M14 12c2 0 3 1.300 3 3.500',
  todo: 'M4 10l3.500 3.500L16 5',
  reply: 'M8 5 3.500 9.500 8 14M3.500 9.500H12a4.500 4.500 0 0 1 4.500 4.500v1',
  replyAll: 'M7 5 2.500 9.500 7 14M11 5 6.500 9.500 11 14M6.500 9.500H13a4 4 0 0 1 4 4v1',
  fwd: 'M12 5l4.500 4.500L12 14M16.500 9.500H8A4.500 4.500 0 0 0 3.500 14v1',
  del: 'M4.500 6h11M8 6V4h4v2M6 6l.700 10h6.600L14 6',
  arch: 'M3 5h14v3H3zM4.500 8v8h11V8M8 11.500h4',
  clip: 'M14 8.500 8.700 13.800a2 2 0 0 1-2.800-2.800l5.700-5.700a3.300 3.300 0 0 1 4.700 4.700l-5.800 5.800',
  srch: 'M8.500 14a5.500 5.500 0 1 0 0-11 5.500 5.500 0 0 0 0 11ZM13 13l4 4',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  chev: 'M6 8l4 4 4-4',
  chevR: 'M8 6l4 4-4 4',
  inbox: 'M3 11l2-6h10l2 6v4H3zM3 11h4l1 2h4l1-2h4',
  send: 'M17 3 3 9l5 2 2 5zM8 11l9-8',
  draft: 'M4 16l1-4L14 3l3 3-9 9zM12 5l3 3',
  trash: 'M4.500 6h11M8 6V4h4v2M6 6l.700 10h6.600L14 6',
  junk: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM5 5l10 10',
  folder: 'M3 5h5l1.500 2H17v8H3z',
  flag: 'M5 17V3.500M5 4h9l-2 3.500 2 3.500H5',
  min: 'M5 10h10',
  max: 'M5.500 5.500h9v9h-9z',
  x: 'M5 5l10 10M15 5 5 15',
  plus: 'M10 4v12M4 10h12',
  lock: 'M5.500 9h9v7h-9zM7.500 9V6.500a2.500 2.500 0 0 1 5 0V9',
  dl: 'M10 3v9M6.500 8.500 10 12l3.500-3.500M4 16h12',
  up: 'M10 13V4M6.500 7.500 10 4l3.500 3.500M4 16h12',
  home: 'M3.500 9.500 10 4l6.500 5.500M5 8.500V16h10V8.500',
  doc: 'M5 2.500h7l3 3V17.500H5zM12 2.500v3h3',
  back: 'M12 5l-5 5 5 5',
  fwdNav: 'M8 5l5 5-5 5',
  refresh: 'M15.500 10A5.500 5.500 0 1 1 13.800 6M15.500 3.500V7h-3.500',
  star: 'M10 3.500l2 4.200 4.500.6-3.300 3.100.9 4.500L10 13.600l-4.100 2.300.9-4.500L3.500 8.300 8 7.700z',
  chat: 'M4 4.500h12v8H9l-4 3v-3H4z',
  bell: 'M5.500 14V9a4.500 4.500 0 0 1 9 0v5l1 1.500h-11zM8.500 17h3',
  phone: 'M5 3.500h3l1 3.500-2 1.500a9 9 0 0 0 4.500 4.500L13 11l3.500 1v3A1.500 1.500 0 0 1 15 16.500 11.500 11.500 0 0 1 3.500 5 1.500 1.500 0 0 1 5 3.500Z',
  emoji: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM7.500 8.500h.01M12.500 8.500h.01M7 12q3 3 6 0',
  print: 'M6 7V3.500h8V7M6 13H4V7h12v6h-2M6 11.500h8V17H6z',
  zoomIn: 'M8.500 14a5.500 5.500 0 1 0 0-11 5.500 5.500 0 0 0 0 11ZM13 13l4 4M6.500 8.500h4M8.500 6.500v4',
  zoomOut: 'M8.500 14a5.500 5.500 0 1 0 0-11 5.500 5.500 0 0 0 0 11ZM13 13l4 4M6.500 8.500h4',
  gear: 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM10 2.500v2M10 15.500v2M2.500 10h2M15.500 10h2M4.700 4.700l1.400 1.400M13.900 13.900l1.400 1.400M4.700 15.300l1.400-1.400M13.900 6.100l1.400-1.400',
  user: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17c0-3 2.500-5 6-5s6 2 6 5',
}

/** The icon a .tdf shows in an attachment well or a folder listing. */
export const TdfGlyph = ({ w = 22, h = 26 }) => (
  <svg width={w} height={h} viewBox="0 0 22 26" aria-hidden="true"><path d="M2 1h12l6 6v18H2z" fill="#fff" stroke="#8a8886" /><path d="M14 1v6h6" fill="none" stroke="#8a8886" /><rect x="0" y="12" width="17" height="8" rx="1.500" fill="#1d4f91" /><text x="8.500" y="18.300" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff" fontFamily="Segoe UI, sans-serif">TDF</text></svg>
)

/** The classic Windows message box. Its wording is deliberately generic: the machine cannot know why a key was refused. */
export function ErrorDialog({ res, name, onClose }) {
  if (!res) return null
  const pending = res.status === 'pending'
  return (
    <div className="ox-scrim">
      <div className="ox-dlg" role="alertdialog" aria-labelledby="ox-t">
        <div className="ox-dh"><span>{pending ? 'Virtru' : 'Error'}</span>
          <button onClick={onClose} aria-label="Close">✕</button></div>
        {pending ? (
          <div className="ox-db"><p>Opening {name}…</p></div>
        ) : (
          <div className="ox-db">
            <span className="ox-ic" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#d13438" /><path d="m10 10 12 12M22 10 10 22" stroke="#fff" strokeWidth="3.500" strokeLinecap="round" /></svg>
            </span>
            <div>
              <p id="ox-t">Error: unable to open file.</p>
              <p>{name}</p>
              <p>This file is protected and could not be decrypted. Contact the sender if you think you should have access.</p>
            </div>
          </div>
        )}
        <div className="ox-df"><button onClick={onClose}>OK</button></div>
      </div>
    </div>
  )
}
