// Interface text for the stand-in supply-chain system, in English, Italian and Japanese.
// Only the application's own words live here. Document titles, document bodies and the markings on
// them come from the files themselves and are never translated.

export const langOf = (person) => (person?.nation === 'ITA' ? 'it' : person?.nation === 'JPN' ? 'ja' : 'en')

// English text -> [Italian, Japanese]
const D = {
  // entitlements and the reason strip
  'Entitlements': ['Autorizzazioni', '権限'],
  'Account disabled': ['Account disabilitato', 'アカウントは無効です'],
  'No programme attributes': ['Nessun attributo di programma', 'プログラム属性なし'],
  'Opened on': ['Aperto grazie a', '開けた根拠'],
  'Checked against your attributes': ['Verificato sui tuoi attributi', 'あなたの属性との照合結果'],
  'holds': ['possiede', '保有'],
  'holds nothing': ['non possiede nulla', '保有なし'],
  'Remove from this change request': ['Rimuovi da questa richiesta di modifica', 'この変更要求から削除'],
  'removed {0}': ['ha rimosso {0}', '{0}を削除しました'],
  'Approver, design authority': ['Approvatore, autorità di progetto', '承認者、設計責任者'],
  'Reviewer, propulsion interfaces': ['Revisore, interfacce di propulsione', 'レビュー担当、推進インターフェース'],
  'Export reviewer': ['Revisore export', '輸出レビュー担当'],
  'Approve {0}': ['Approva {0}', '{0}を承認'],
  'Export check on {0}': ['Verifica export su {0}', '{0}の輸出確認'],
  'Sensors interface review': ['Revisione interfacce sensori', 'センサーインターフェースのレビュー'],
  'Propulsion interface review': ['Revisione interfacce di propulsione', '推進インターフェースのレビュー'],
  'Nothing assigned to you.': ['Nulla assegnato a te.', '割り当てはありません。'],
  'Unknown user': ['Utente sconosciuto', '不明なユーザー'],
  'external email': ['email esterna', '外部メール'],
  'Teams channel': ['canale Teams', 'Teams チャネル'],
  'tried to open {0} · sent by {1}': ['ha tentato di aprire {0} · inviato da {1}', '{0}を開こうとしました · 送信者 {1}'],
  // navigation and chrome
  'Home': ['Home', 'ホーム'],
  'Changes': ['Modifiche', '変更'],
  'Parts': ['Parti', '部品'],
  'Suppliers': ['Fornitori', 'サプライヤー'],
  'Orders': ['Ordini', '発注'],
  'Search': ['Cerca', '検索'],
  'Sign in as': ['Accedi come', '切り替えるユーザー'],
  "Edit {0}'s access": ['Modifica l’accesso di {0}', '{0}のアクセスを編集'],
  'disabled': ['disabilitato', '無効'],
  'Close': ['Chiudi', '閉じる'],
  'Mail': ['Posta', 'メール'],
  'External': ['Esterno', '外部'],
  // home
  'Good morning, {0}': ['Buongiorno, {0}', 'おはようございます、{0}さん'],
  'My tasks': ['Le mie attività', '自分のタスク'],
  'Recent activity': ['Attività recente', '最近のアクティビティ'],
  'Due {0}': ['Scadenza {0}', '期限 {0}'],
  'Review {0}': ['Rivedi {0}', '{0}をレビュー'],
  'Confirm PO-88250 delivery date': ['Conferma la data di consegna di PO-88250', 'PO-88250の納期を確認'],
  // change request
  'Change requests': ['Richieste di modifica', '変更要求'],
  'Summary': ['Riepilogo', '概要'],
  'Attachments': ['Allegati', '添付ファイル'],
  'Approvals': ['Approvazioni', '承認'],
  'History': ['Cronologia', '履歴'],
  'Work package': ['Pacchetto di lavoro', 'ワークパッケージ'],
  'Your role': ['Il tuo ruolo', 'あなたの役割'],
  'Need-by': ['Necessario entro', '必要期日'],
  'Owner': ['Responsabile', '担当'],
  'Comments': ['Commenti', 'コメント'],
  'No comments yet.': ['Ancora nessun commento.', 'コメントはまだありません。'],
  'Add a comment': ['Aggiungi un commento', 'コメントを追加'],
  'Post': ['Invia', '投稿'],
  'No attachments.': ['Nessun allegato.', '添付ファイルはありません。'],
  'Attach from the programme library': ['Allega dalla libreria del programma', 'プログラムライブラリから添付'],
  'Choose a document…': ['Scegli un documento…', 'ドキュメントを選択…'],
  'Approver': ['Approvatore', '承認者'],
  'Role': ['Ruolo', '役割'],
  'Decision': ['Decisione', '判定'],
  'Pending': ['In attesa', '保留中'],
  'Approve as design authority': ['Approva come autorità di progetto', '設計責任者として承認'],
  'Only an approver can act on this change.': ['Solo un approvatore può agire su questa modifica.', 'この変更を処理できるのは承認者のみです。'],
  'GIGO Airworthiness': ['Aeronavigabilità GIGO', 'GIGO 耐空性'],
  'Programme authority': ['Autorità di programma', 'プログラム責任者'],
  'Share': ['Condividi', '共有'],
  'Share with': ['Condividi con', '共有先'],
  'Send': ['Invia', '送信'],
  'A personal Gmail address': ['Un indirizzo Gmail personale', '個人のGmailアドレス'],
  // attachments
  'encrypted file': ['file cifrato', '暗号化ファイル'],
  'encrypted files': ['file cifrati', '暗号化ファイル'],
  'Open': ['Apri', '開く'],
  'File properties': ['Proprietà del file', 'ファイルのプロパティ'],
  'Download the encrypted file': ['Scarica il file cifrato', '暗号化ファイルをダウンロード'],
  // viewer
  'ASKING THE KEY SERVER…': ['INTERROGO IL SERVER DELLE CHIAVI…', 'キーサーバーに問い合わせ中…'],
  'Withheld from this release': ['Non incluso in questa versione', 'このリリースでは非開示'],
  'Not part of this release. Not in this file.': ['Non fa parte di questa versione. Non è in questo file.', 'このリリースには含まれません。このファイルにもありません。'],
  'key released by': ['chiave rilasciata da', '鍵の発行元:'],
  'REFUSED': ['NEGATO', '拒否'],
  'Needs': ['Richiede', '必要'],
  'The file is here, byte for byte. Still ciphertext.': ['Il file è qui, byte per byte. Ancora testo cifrato.', 'ファイルはここにあり、バイト単位で同一です。依然として暗号文のままです。'],
  'Your attributes do not satisfy the policy written inside this file.': ['I tuoi attributi non soddisfano la policy scritta all’interno di questo file.', 'あなたの属性は、このファイルに書き込まれたポリシーを満たしていません。'],
  'Access removed. The key server was asked again and said no.': ['Accesso revocato. Il server delle chiavi è stato interrogato di nuovo e ha rifiutato.', 'アクセスが取り消されました。キーサーバーに再度問い合わせましたが、拒否されました。'],
  'This account is disabled. The key server will not release a key.': ['Questo account è disabilitato. Il server delle chiavi non rilascerà alcuna chiave.', 'このアカウントは無効です。キーサーバーは鍵を発行しません。'],
  'There is no identity to ask the key server about.': ['Non c’è alcuna identità su cui interrogare il server delle chiavi.', 'キーサーバーに問い合わせるべきIDがありません。'],
  'an active account': ['un account attivo', '有効なアカウント'],
  'an authenticated programme account': ['un account di programma autenticato', '認証済みのプログラムアカウント'],
  // log
  'permit': ['consentito', '許可'],
  'deny': ['negato', '拒否'],
  'just now': ['adesso', 'たった今'],
  'yesterday': ['ieri', '昨日'],
  '2 h ago': ['2 h fa', '2時間前'],
  '3 days ago': ['3 giorni fa', '3日前'],
  '5 days ago': ['5 giorni fa', '5日前'],
  'created the change request': ['ha creato la richiesta di modifica', '変更要求を作成しました'],
  'submitted it for review': ['l’ha inviata in revisione', 'レビューに提出しました'],
  'attached ICD baseline': ['ha allegato la baseline dell’ICD', 'ICDベースラインを添付しました'],
  'opened {0}': ['ha aperto {0}', '{0}を開きました'],
  'opened {0} · {1}': ['ha aperto {0} · {1}', '{0}を開きました · {1}'],
  'was refused {0}': ['si è visto negare {0}', '{0}へのアクセスが拒否されました'],
  'lost access to {0}': ['ha perso l’accesso a {0}', '{0}へのアクセスを失いました'],
  'regained access to {0}': ['ha riottenuto l’accesso a {0}', '{0}へのアクセスが回復しました'],
  "disabled {0}'s account": ['ha disabilitato l’account di {0}', '{0}のアカウントを無効にしました'],
  "restored {0}'s account": ['ha ripristinato l’account di {0}', '{0}のアカウントを復元しました'],
  'attached {0}': ['ha allegato {0}', '{0}を添付しました'],
  'approved the change as design authority': ['ha approvato la modifica come autorità di progetto', '設計責任者として変更を承認しました'],
  'shared this change request with {0}': ['ha condiviso questa richiesta di modifica con {0}', 'この変更要求を{0}と共有しました'],
  'GIGO Document Control': ['Controllo documenti GIGO', 'GIGO 文書管理'],
  'GIGO identity admin': ['Amministrazione identità GIGO', 'GIGO IDアドミン'],
  'Programme office': ['Ufficio di programma', 'プログラム事務局'],
  'Shared: {0} · {1}': ['Condiviso: {0} · {1}', '共有: {0} · {1}'],
  'From {0} · {1}': ['Da {0} · {1}', '送信者 {0} · {1}'],
  // table headers
  'ID': ['ID', 'ID'],
  'Title': ['Titolo', 'タイトル'],
  'Status': ['Stato', 'ステータス'],
  'Package': ['Pacchetto', 'パッケージ'],
  'Due': ['Scadenza', '期限'],
  'Part': ['Parte', '部品'],
  'Description': ['Descrizione', '説明'],
  'Rev': ['Rev', '版'],
  'Supplier': ['Fornitore', 'サプライヤー'],
  'Lead': ['Consegna', 'リードタイム'],
  'Stock': ['Giacenza', '在庫'],
  'Tier': ['Livello', 'ティア'],
  'Country': ['Paese', '国'],
  'On-time': ['Puntualità', '納期遵守'],
  'Open POs': ['Ordini aperti', '未完了発注'],
  'PO': ['PO', '発注'],
  'Qty': ['Qtà', '数量'],
  'Nothing matches.': ['Nessun risultato.', '該当なし。'],
  'Asking the key server…': ['Richiesta al server delle chiavi…', 'キーサーバーに確認中…'],
  // statuses
  'Approved': ['Approvata', '承認済み'],
  'Implemented': ['Implementata', '実施済み'],
  'In review': ['In revisione', 'レビュー中'],
  'On hold': ['Sospesa', '保留'],
  'Draft': ['Bozza', '下書き'],
  'In production': ['In produzione', '製造中'],
  'Confirmed': ['Confermato', '確定'],
  'Shipped': ['Spedito', '出荷済み'],
  'Awaiting drawing': ['In attesa del disegno', '図面待ち'],
  // work packages
  'Airframe': ['Cellula', '機体'],
  'Integration': ['Integrazione', 'インテグレーション'],
  'Propulsion': ['Propulsione', '推進'],
  'Sensors': ['Sensori', 'センサー'],
  // change requests
  'Revise ICD baseline: mission bus, thermal loops, mounting pattern': ['Revisione della baseline ICD: bus di missione, circuiti termici, schema di montaggio', 'ICDベースラインの改訂:ミッションバス、熱ループ、取付パターン'],
  'Update connector class B pin allocation': ['Aggiornamento assegnazione pin connettore classe B', 'クラスBコネクタのピン割り当て更新'],
  'Change coolant fitting to SS316': ['Modifica raccordo del refrigerante in SS316', '冷却剤継手をSS316に変更'],
  'Relax tolerance on fairing bracket hole pattern': ['Allentamento tolleranza sulla foratura della staffa di carenatura', 'フェアリングブラケット穴パターンの公差緩和'],
  'Add vibration damper to avionics tray': ['Aggiunta smorzatore di vibrazioni al vassoio avionico', 'アビオニクストレイへの防振ダンパー追加'],
  'Supplier change: harness assembly': ['Cambio fornitore: cablaggio', 'サプライヤー変更: ハーネス組立'],
  'Revise paint specification, zone 1': ['Revisione specifica di verniciatura, zona 1', '塗装仕様の改訂(ゾーン1)'],
  'Correct BOM quantity, actuator mount': ['Correzione quantità in distinta, supporto attuatore', '部品表数量の訂正(アクチュエータマウント)'],
  // parts
  'Mounting bracket, zone 3, Al 7075': ['Staffa di montaggio, zona 3, Al 7075', '取付ブラケット、ゾーン3、Al 7075'],
  'Fairing bracket, zone 2': ['Staffa di carenatura, zona 2', 'フェアリングブラケット、ゾーン2'],
  'Connector B-24, circular': ['Connettore B-24, circolare', 'コネクタ B-24、円形'],
  'Harness assembly, avionics bay': ['Cablaggio, vano avionico', 'ハーネス組立、アビオニクスベイ'],
  'Coolant fitting, SS316': ['Raccordo refrigerante, SS316', '冷却剤継手、SS316'],
  'Actuator mount, port': ['Supporto attuatore, sinistro', 'アクチュエータマウント、左舷'],
  'Avionics tray assembly': ['Gruppo vassoio avionico', 'アビオニクストレイ組立'],
  'Vibration damper, type 3': ['Smorzatore di vibrazioni, tipo 3', '防振ダンパー、タイプ3'],
  // orders
  'Mounting bracket, zone 3': ['Staffa di montaggio, zona 3', '取付ブラケット、ゾーン3'],
  'Connector B-24': ['Connettore B-24', 'コネクタ B-24'],
  'Vibration damper': ['Smorzatore di vibrazioni', '防振ダンパー'],
  'Harness assembly': ['Cablaggio', 'ハーネス組立'],
  'Fairing bracket': ['Staffa di carenatura', 'フェアリングブラケット'],
  // suppliers
  'Tier 1': ['Livello 1', 'ティア1'],
  'Tier 2': ['Livello 2', 'ティア2'],
  'Tier 3': ['Livello 3', 'ティア3'],
  'United Kingdom': ['Regno Unito', '英国'],
  'Italy': ['Italia', 'イタリア'],
  'Japan': ['Giappone', '日本'],
  // people
  'Design authority': ['Autorità di progetto', '設計責任者'],
  'Programme security': ['Sicurezza di programma', 'プログラム・セキュリティ'],
  'Propulsion lead': ['Responsabile propulsione', '推進リード'],
  'Sensors engineer': ['Ingegnere sensori', 'センサーエンジニア'],
  'Funding controller': ['Controllo finanziamenti', '資金管理担当'],
  'Export and contracts': ['Export e contratti', '輸出・契約'],
  'Production engineer': ['Ingegnere di produzione', '生産エンジニア'],
  'Machinist': ['Operatore CNC', '機械工'],
  'ACE administrator': ['Amministratore ACE', 'ACE管理者'],
  'Business development': ['Sviluppo commerciale', '事業開発'],
  'Tier-2 supplier': ['Fornitore di livello 2', 'ティア2サプライヤー'],
  'Tier-3 supplier': ['Fornitore di livello 3', 'ティア3サプライヤー'],
  'Edgewing IT': ['IT Edgewing', 'Edgewing IT'],
  'A competing prime': ['Un prime concorrente', '競合する主契約企業'],
  'No programme account': ['Nessun account di programma', 'プログラムアカウントなし'],
}

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov" or "14 Nov 2026" written the way the reader's language writes dates. */
function date(lang, s) {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2})( \d{4})?$/.exec(s)
  if (!m || lang === 'en') return s
  const mo = MONTHS_EN.indexOf(m[2])
  if (mo < 0) return s
  const day = Number(m[1])
  const year = m[3]?.trim()
  if (lang === 'it') return `${day} ${MONTHS_IT[mo]}${year ? ` ${year}` : ''}`
  return `${year ? `${year}年` : ''}${mo + 1}月${day}日`
}

/** "14 d" lead times. */
function days(lang, s) {
  const m = /^(\d+) d$/.exec(s)
  if (!m || lang === 'en') return s
  return lang === 'it' ? `${m[1]} g` : `${m[1]}日`
}

/** Returns t(text, ...args) for one language. English is the identity, apart from filling {0}, {1}. */
export function makeT(lang) {
  const i = lang === 'it' ? 0 : 1
  const t = (s, ...args) => {
    let out = lang === 'en' ? s : (D[s]?.[i] ?? s)
    args.forEach((a, n) => { out = out.split(`{${n}}`).join(a) })
    return out
  }
  t.date = (s) => date(lang, s)
  t.days = (s) => days(lang, s)
  t.lang = lang
  return t
}
