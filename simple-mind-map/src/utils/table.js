/**
 * 表格处理与 Markdown 表格双向转换工具集
 * 参考 GitHub Logseq (haydenull/logseq-plugin-markdown-table) 规范
 */

export const escapeHtml = str =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const unescapeHtml = str =>
  String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')

/**
 * 判断文本是否包含 Markdown 表格语法
 */
export const isMarkdownTable = text => {
  if (!text || typeof text !== 'string') return false
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i]
    const next = lines[i + 1]
    // 检查分隔行形如: | --- | :---: | ---: | 或 --- | ---
    const isDivider =
      /^\|?(\s*:?-{2,}:?\s*\|?)+$/.test(next) &&
      next.includes('-') &&
      cur.includes('|')
    if (isDivider) return true
  }
  return false
}

/**
 * 将 Markdown 表格解析为矩阵数据结构
 */
export const markdownTableToMatrix = text => {
  if (!text || typeof text !== 'string') {
    return { matrix: [], alignments: [], hasHeader: true, prefixText: '', postfixText: '' }
  }

  const lines = text.split(/\r?\n/)
  let tableStart = -1
  let dividerIndex = -1
  let tableEnd = -1

  for (let i = 0; i < lines.length - 1; i++) {
    const nextTrim = lines[i + 1].trim()
    if (
      lines[i].includes('|') &&
      /^\|?(\s*:?-{2,}:?\s*\|?)+$/.test(nextTrim) &&
      nextTrim.includes('-')
    ) {
      tableStart = i
      dividerIndex = i + 1
      break
    }
  }

  if (tableStart === -1) {
    return { matrix: [], alignments: [], hasHeader: true, prefixText: text, postfixText: '' }
  }

  // 寻找表格结束行
  tableEnd = dividerIndex + 1
  while (tableEnd < lines.length && lines[tableEnd].trim().includes('|')) {
    tableEnd++
  }

  const prefixLines = lines.slice(0, tableStart)
  const postfixLines = lines.slice(tableEnd)

  const parseRow = line => {
    let raw = line.trim()
    if (raw.startsWith('|')) raw = raw.slice(1)
    if (raw.endsWith('|')) raw = raw.slice(0, -1)
    return raw.split('|').map(cell => cell.trim().replace(/<br\s*\/?>/gi, '\n'))
  }

  // 解析对齐方式
  const dividerParts = parseRow(lines[dividerIndex])
  const alignments = dividerParts.map(part => {
    const p = part.trim()
    const left = p.startsWith(':')
    const right = p.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })

  const headerRow = parseRow(lines[tableStart])
  const bodyRows = []
  for (let r = dividerIndex + 1; r < tableEnd; r++) {
    const row = parseRow(lines[r])
    if (row.length > 0) {
      bodyRows.push(row)
    }
  }

  const maxCols = Math.max(
    headerRow.length,
    ...bodyRows.map(r => r.length),
    alignments.length,
    1
  )

  const padRow = row => {
    const res = [...row]
    while (res.length < maxCols) res.push('')
    return res
  }

  const matrix = [padRow(headerRow), ...bodyRows.map(padRow)]
  while (alignments.length < maxCols) alignments.push('left')

  return {
    matrix,
    alignments,
    hasHeader: true,
    prefixText: prefixLines.join('\n').trim(),
    postfixText: postfixLines.join('\n').trim()
  }
}

/**
 * 将矩阵数据转换为 Markdown 表格格式 (Logseq / GitHub 兼容)
 */
export const matrixToMarkdownTable = ({ matrix = [], alignments = [], hasHeader = true } = {}) => {
  if (!matrix || matrix.length === 0) return ''
  const rows = [...matrix]
  const colCount = Math.max(...rows.map(r => r.length), 1)

  const safeCell = val => String(val || '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')

  const alignMark = align => {
    if (align === 'center') return ':---:'
    if (align === 'right') return '---:'
    return ':---'
  }

  const header = rows[0] || new Array(colCount).fill('')
  let md = '| ' + header.map((c, i) => safeCell(c || `列 ${i + 1}`)).join(' | ') + ' |\n'
  md += '| ' + new Array(colCount).fill(0).map((_, i) => alignMark(alignments[i] || 'left')).join(' | ') + ' |\n'

  const body = hasHeader ? rows.slice(1) : rows
  body.forEach(row => {
    const cells = []
    for (let c = 0; c < colCount; c++) {
      cells.push(safeCell(row[c] || ''))
    }
    md += '| ' + cells.join(' | ') + ' |\n'
  })

  return md.trim()
}

/**
 * 将 HTML <table> 字符串或 DOM 元素解析为矩阵数据结构
 */
export const htmlTableToMatrix = htmlOrEl => {
  const result = {
    matrix: [],
    alignments: [],
    hasHeader: true,
    prefixText: '',
    postfixText: ''
  }

  if (!htmlOrEl) return result

  let tableEl = null
  let fullHtml = ''

  if (typeof htmlOrEl === 'string') {
    fullHtml = htmlOrEl
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlOrEl, 'text/html')
        tableEl = doc.querySelector('table')
        if (tableEl) {
          const raw = doc.body.innerHTML
          const outer = tableEl.outerHTML
          const parts = raw.split(outer)
          result.prefixText = (parts[0] || '').trim()
          result.postfixText = (parts.length > 1 ? parts.slice(1).join(outer) : '').trim()
        }
      } catch (e) {
        tableEl = null
      }
    }
  } else if (htmlOrEl && htmlOrEl.nodeType === 1) {
    tableEl = htmlOrEl.tagName.toLowerCase() === 'table' ? htmlOrEl : htmlOrEl.querySelector('table')
  }

  if (!tableEl) {
    result.prefixText = fullHtml
    return result
  }

  const trs = Array.from(tableEl.querySelectorAll('tr'))
  if (trs.length === 0) return result

  const hasTh = trs[0].querySelectorAll('th').length > 0
  result.hasHeader = hasTh

  let maxCols = 0
  const alignments = []

  const matrix = trs.map((tr, rIndex) => {
    const cells = Array.from(tr.querySelectorAll('th, td'))
    maxCols = Math.max(maxCols, cells.length)
    return cells.map((cell, cIndex) => {
      if (rIndex === 0) {
        const align =
          cell.style.textAlign ||
          cell.getAttribute('align') ||
          'left'
        alignments[cIndex] = align.toLowerCase()
      }
      return cell.innerText.replace(/\u00a0/g, ' ').trim()
    })
  })

  maxCols = Math.max(maxCols, 1)
  matrix.forEach(row => {
    while (row.length < maxCols) row.push('')
  })
  while (alignments.length < maxCols) alignments.push('left')

  result.matrix = matrix
  result.alignments = alignments
  return result
}

/**
 * 将矩阵数据转换为 HTML <table> 字符串
 */
export const matrixToHtmlTable = ({
  matrix = [],
  alignments = [],
  hasHeader = true,
  className = 'smm-node-table'
} = {}) => {
  if (!matrix || matrix.length === 0) return ''
  const colCount = Math.max(...matrix.map(r => r.length), 1)

  const getAlignStyle = cIndex => {
    const a = alignments[cIndex] || 'left'
    return `text-align: ${a};`
  }

  let html = `<table class="${className}">`

  if (hasHeader && matrix.length > 0) {
    html += '<thead><tr>'
    for (let c = 0; c < colCount; c++) {
      const val = escapeHtml(matrix[0][c] || '')
      html += `<th style="${getAlignStyle(c)}">${val}</th>`
    }
    html += '</tr></thead><tbody>'
    for (let r = 1; r < matrix.length; r++) {
      html += '<tr>'
      for (let c = 0; c < colCount; c++) {
        const val = escapeHtml(matrix[r][c] || '')
        html += `<td style="${getAlignStyle(c)}">${val}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody>'
  } else {
    html += '<tbody>'
    matrix.forEach(row => {
      html += '<tr>'
      for (let c = 0; c < colCount; c++) {
        const val = escapeHtml(row[c] || '')
        html += `<td style="${getAlignStyle(c)}">${val}</td>`
      }
      html += '</tr>'
    })
    html += '</tbody>'
  }

  html += '</table>'
  return html
}

/**
 * 将文本中的 Markdown 表格批量转换为 HTML 表格
 */
export const markdownTableToHtml = text => {
  if (!text || typeof text !== 'string') return text || ''
  if (!isMarkdownTable(text)) return text

  const lines = text.split(/\r?\n/)
  const resultLines = []
  let inTable = false
  let currentTableLines = []

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      const parsed = markdownTableToMatrix(currentTableLines.join('\n'))
      if (parsed.matrix.length > 0) {
        resultLines.push(matrixToHtmlTable(parsed))
      } else {
        resultLines.push(...currentTableLines)
      }
      currentTableLines = []
    }
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]

    if (!inTable) {
      const isHeaderAndDivider =
        line.includes('|') &&
        nextLine &&
        /^\|?(\s*:?-{2,}:?\s*\|?)+$/.test(nextLine.trim()) &&
        nextLine.includes('-')
      if (isHeaderAndDivider) {
        inTable = true
        currentTableLines.push(line)
      } else {
        resultLines.push(line)
      }
    } else {
      if (line.trim().includes('|')) {
        currentTableLines.push(line)
      } else {
        flushTable()
        resultLines.push(line)
      }
    }
  }
  flushTable()

  return resultLines.join('\n')
}

/**
 * 将 HTML 中的表格转换为 Markdown 表格格式
 */
export const htmlTableToMarkdown = htmlOrEl => {
  const parsed = htmlTableToMatrix(htmlOrEl)
  if (parsed.matrix.length === 0) return ''
  return matrixToMarkdownTable(parsed)
}

/**
 * 解析从 Excel/WPS/剪贴板复制的 TSV (制表符分隔) 或 CSV (逗号分隔)
 */
export const csvOrTsvToMatrix = rawText => {
  if (!rawText || typeof rawText !== 'string') {
    return { matrix: [], hasHeader: true }
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return { matrix: [], hasHeader: true }

  // 优先检测是否是 Markdown 表格
  if (isMarkdownTable(rawText)) {
    return markdownTableToMatrix(rawText)
  }

  // 探测分隔符：制表符优先 (Excel 复制)，其次逗号
  const firstLine = lines[0]
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length

  const delimiter = tabCount > 0 ? '\t' : commaCount > 0 ? ',' : '\t'

  const matrix = lines.map(line =>
    line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''))
  )

  const maxCols = Math.max(...matrix.map(r => r.length), 1)
  matrix.forEach(row => {
    while (row.length < maxCols) row.push('')
  })

  return {
    matrix,
    alignments: new Array(maxCols).fill('left'),
    hasHeader: true
  }
}
