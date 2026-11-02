import { describe, test, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'

const rootDir = path.resolve(__dirname, '..')

describe('版本标识与展示体系校验 (Version Display & Differentiation)', () => {
  const webPkgPath = path.join(rootDir, 'web/package.json')
  const enginePkgPath = path.join(rootDir, 'simple-mind-map/package.json')
  const navToolbarPath = path.join(rootDir, 'web/src/pages/Edit/components/NavigatorToolbar.vue')
  const langZhPath = path.join(rootDir, 'web/src/lang/zh_cn.js')

  test('正确区分应用版本 (mind-map-main) 与渲染引擎版本 (simple-mind-map)', () => {
    const webPkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf-8'))
    const enginePkg = JSON.parse(fs.readFileSync(enginePkgPath, 'utf-8'))

    expect(webPkg.name).toBe('mind-map-main')
    expect(webPkg.version).toBeDefined()
    expect(enginePkg.name).toBe('simple-mind-map')
    expect(enginePkg.version).toBe('0.14.0-fix.3')

    // 应用版本与引擎内核版本不能混淆
    expect(webPkg.version).not.toBe(enginePkg.version)
  })

  test('NavigatorToolbar.vue 正确引入并分别绑定应用版本与引擎版本', () => {
    const navContent = fs.readFileSync(navToolbarPath, 'utf-8')

    // 检查引入
    expect(navContent).toContain("import appPkg from '../../../../package.json'")
    expect(navContent).toContain("import enginePkg from 'simple-mind-map/package.json'")

    // 检查数据绑定
    expect(navContent).toContain('appVersion: appPkg.version')
    expect(navContent).toContain('engineVersion: enginePkg.version')

    // 检查模版展示
    expect(navContent).toContain('appVersion')
    expect(navContent).toContain('engineVersion')
  })

  test('语言字典完整包含 appVersion 与 engineVersion 翻译项', () => {
    const zhContent = fs.readFileSync(langZhPath, 'utf-8')
    expect(zhContent).toContain("appVersion: '应用版本：'")
    expect(zhContent).toContain("engineVersion: '内核版本：'")
  })
})
