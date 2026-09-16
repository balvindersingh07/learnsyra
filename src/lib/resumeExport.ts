import type { ResumeDoc } from './resumeBuilder'
import { exportPlain } from './resumeBuilder'
import { SECTION_CATALOG } from './resumeStudioTypes'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(text: string) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function buildDocxXml(doc: ResumeDoc) {
  const lines = exportPlain(doc).split('\n')
  const body = lines.map(line => paragraph(line)).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr/></w:body>
</w:document>`
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number) {
  const b = new Uint8Array(2)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  return b
}

function u32(n: number) {
  const b = new Uint8Array(4)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  b[2] = (n >>> 16) & 0xff
  b[3] = (n >>> 24) & 0xff
  return b
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const encoder = new TextEncoder()
  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ])
    chunks.push(local)
    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    )
    offset += local.length
  }
  const centralDir = concat(central)
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralDir.length), u32(offset), u16(0)])
  return new Blob([concat([...chunks, centralDir, end])], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export function downloadResumeDocx(doc: ResumeDoc) {
  const documentXml = buildDocxXml(doc)
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  const wordRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  const encoder = new TextEncoder()
  const blob = zipStore([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rels) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(wordRels) },
  ])
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.versionName.replace(/\s+/g, '-')}.docx`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadResumeText(doc: ResumeDoc, ext: 'txt' | 'doc') {
  const blob = new Blob([exportPlain(doc)], { type: ext === 'doc' ? 'application/msword' : 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.versionName.replace(/\s+/g, '-')}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function printResumePreview() {
  window.print()
}

export function exportCoverLetterText(doc: ResumeDoc) {
  const letter = doc.coverLetter
  if (!letter) return ''
  return [
    letter.recipient,
    letter.company,
    '',
    letter.body,
    '',
    letter.signature,
  ].join('\n')
}

export function sectionLabel(id: string) {
  return SECTION_CATALOG.find(s => s.id === id)?.label ?? id
}
