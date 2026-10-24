import { describe, expect, test } from 'bun:test'
import {
  escapeHtml,
  unescapeHtml,
  isMarkdownTable,
  markdownTableToMatrix,
  matrixToMarkdownTable,
  htmlTableToMatrix,
  matrixToHtmlTable,
  markdownTableToHtml,
  htmlTableToMarkdown,
  csvOrTsvToMatrix
} from '../simple-mind-map/src/utils/table'
import { removeRichTextStyes } from '../simple-mind-map/src/utils'

describe('Table Support & Markdown Table Conversion (Logseq style)', () => {
  test('isMarkdownTable correctly detects Markdown tables', () => {
    const validMd = `| 概念 | 说明 | 示例 |
| :--- | :---: | ---: |
| 氧化 | 失去电子 | 铁生锈 |`
    expect(isMarkdownTable(validMd)).toBe(true)

    const noDivider = `| 概念 | 说明 |
| 氧化 | 失去电子 |`
    expect(isMarkdownTable(noDivider)).toBe(false)

    const plainText = '这是一个普通节点，不包含任何表格'
    expect(isMarkdownTable(plainText)).toBe(false)
  })

  test('markdownTableToMatrix parses markdown table into structured matrix with alignments', () => {
    const md = `前置知识点说明
| 标题 1 | 标题 2 | 标题 3 |
| :--- | :---: | ---: |
| A1 | B1 | C1 |
| A2 | B2 | C2 |
后置知识点总结`

    const parsed = markdownTableToMatrix(md)
    expect(parsed.hasHeader).toBe(true)
    expect(parsed.prefixText).toBe('前置知识点说明')
    expect(parsed.postfixText).toBe('后置知识点总结')
    expect(parsed.alignments).toEqual(['left', 'center', 'right'])
    expect(parsed.matrix).toEqual([
      ['标题 1', '标题 2', '标题 3'],
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2']
    ])
  })

  test('matrixToMarkdownTable converts matrix back into GitHub/Logseq markdown table', () => {
    const matrix = [
      ['列 1', '列 2'],
      ['数据 1', '数据 2']
    ]
    const alignments = ['left', 'center']
    const md = matrixToMarkdownTable({ matrix, alignments, hasHeader: true })
    expect(md).toContain('| 列 1 | 列 2 |')
    expect(md).toContain('| :--- | :---: |')
    expect(md).toContain('| 数据 1 | 数据 2 |')
  })

  test('matrixToHtmlTable generates clean smm-node-table HTML with styling', () => {
    const matrix = [
      ['Col 1', 'Col 2'],
      ['Val 1', 'Val 2']
    ]
    const alignments = ['center', 'right']
    const html = matrixToHtmlTable({ matrix, alignments, hasHeader: true })
    expect(html).toContain('<table class="smm-node-table">')
    expect(html).toContain('<thead><tr><th style="text-align: center;">Col 1</th><th style="text-align: right;">Col 2</th></tr></thead>')
    expect(html).toContain('<tbody><tr><td style="text-align: center;">Val 1</td><td style="text-align: right;">Val 2</td></tr></tbody>')
  })

  test('markdownTableToHtml converts embedded markdown table into HTML table', () => {
    const raw = `重点复习内容:
| 科目 | 知识点 |
| :--- | :--- |
| 数学 | 导数与单调性 |
| 物理 | 电磁感应 |`

    const html = markdownTableToHtml(raw)
    expect(html).toContain('<table class="smm-node-table">')
    expect(html).toContain('导数与单调性')
    expect(html).toContain('电磁感应')
  })

  test('csvOrTsvToMatrix parses Excel TSV paste and CSV text', () => {
    // 模拟 Excel 复制出的制表符分隔数据
    const tsv = '姓名\t成绩\t排名\n张三\t98\t1\n李四\t92\t2'
    const parsedTsv = csvOrTsvToMatrix(tsv)
    expect(parsedTsv.matrix.length).toBe(3)
    expect(parsedTsv.matrix[0]).toEqual(['姓名', '成绩', '排名'])
    expect(parsedTsv.matrix[1]).toEqual(['张三', '98', '1'])

    // CSV 数据
    const csv = '年份,高考,录取率\n2025,新高考,85%\n2026,新高考,88%'
    const parsedCsv = csvOrTsvToMatrix(csv)
    expect(parsedCsv.matrix.length).toBe(3)
    expect(parsedCsv.matrix[0]).toEqual(['年份', '高考', '录取率'])
  })

  test('removeRichTextStyes preserves table HTML structure without stripping it to plain text', () => {
    // 确保包含表格的富文本内容不会在样式重置时被抹平成单行文字
    const tableHtml = '<p>说明文字</p><table class="smm-node-table"><thead><tr><th>头1</th><th>头2</th></tr></thead><tbody><tr><td>值1</td><td>值2</td></tr></tbody></table>'
    const cleaned = removeRichTextStyes(tableHtml)
    expect(cleaned).toContain('<table class="smm-node-table">')
    expect(cleaned).toContain('头1')
    expect(cleaned).toContain('值1')
  })
})
