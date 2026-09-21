import { test, expect } from '@playwright/test'

test('projects, tabs, drag undo, persistence, export and responsive workspace', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Здесь появятся ваши проекты' })).toBeVisible()
  await page.screenshot({ path: 'test-results/home.png', fullPage: true })
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /Блок-схема/ })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: /ERD/ })).toBeDisabled()
  await page.screenshot({ path: 'test-results/chooser.png', fullPage: true })
  await dialog.getByRole('button', { name: /IDEF0/ }).click()
  await expect(page.locator('.project-heading [role=status]')).toHaveText('Сохранено в браузере')
  await page.getByRole('button', { name: 'Создать контекстную диаграмму' }).click()
  const input = page.getByRole('textbox', { name: 'Имя функции' })
  await input.fill('Обработать заказ')
  await input.press('Enter')
  await expect(input).toHaveValue('Обработать заказ')
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(input).toHaveValue('')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  const node = page.locator('.react-flow__node-idef0Function').first()
  const before = await node.boundingBox()
  if (!before) throw new Error('No node bounds')
  await page.mouse.move(before.x + 20, before.y + 15)
  await page.mouse.down()
  await page.mouse.move(before.x + 150, before.y + 90, { steps: 12 })
  await page.mouse.up()
  const moved = await node.boundingBox()
  expect(moved?.x).not.toBe(before.x)
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect.poll(async () => (await node.boundingBox())?.x).toBeCloseTo(before.x, 0)
  await page.getByRole('button', { name: 'Добавить диаграмму', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /IDEF0/ }).click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await page.getByRole('button', { name: 'Закрыть вкладку Новая модель 2' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Новая модель 2 A-0 · IDEF0' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Название проекта' }).fill('Тестовый проект')
  await page.getByRole('textbox', { name: 'Название проекта' }).press('Enter')
  await expect(page.locator('.project-heading [role=status]')).toHaveText('Сохранено в браузере')
  await page.screenshot({ path: 'test-results/editor.png', fullPage: true })
  for (const [label, extension] of [['Векторный SVG', '.svg'], ['Изображение PNG', '.png'], ['Все диаграммы в PDF', '.pdf']] as const) {
    await page.locator('summary').click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: label, exact: true }).click()
    const file = await download
    expect(file.suggestedFilename()).toContain(extension)
    await file.saveAs(`test-results/export${extension}`)
    // Close the open menu after export.
    await page.locator('summary').click()
  }
  await page.reload()
  await page.getByRole('button', { name: /Тестовый проект/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Имя функции' })).toHaveValue('Обработать заказ')
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.getByRole('button', { name: 'Переключить свойства' }).click()
  await expect(page.locator('.react-flow')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('failed autosave is visible, JSON remains available and saving can be retried', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = original
      void args
      throw new DOMException('Test quota', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /IDEF0/ }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить')
  await expect(page.locator('.project-heading [role=status]')).toHaveText('Не удалось сохранить')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  expect((await download).suggestedFilename()).toContain('.json')
  await page.getByRole('button', { name: 'Повторить сохранение' }).click()
  await expect(page.locator('.project-heading [role=status]')).toHaveText('Сохранено в браузере')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('legacy draft is migrated and invalid imports preserve the active project', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ulstu-idef0:last-project', JSON.stringify({
      id: 'legacy-project', name: 'Старый проект', version: '1.0.0', rootDiagramId: 'root',
      diagrams: [{ id: 'root', title: 'Контекст', nodeNumber: 'A-0', parentDiagramId: null, parentNodeId: null, isContext: true, nodes: [], arrows: [] }],
      settings: { strictMode: true, snapToGrid: true, showMiniMap: true, autoSave: true },
      meta: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: /Старый проект/ }).first().click()
  expect(await page.evaluate(() => localStorage.getItem('ulstu-idef0:last-project'))).toBeNull()
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(page.getByRole('alert')).toContainText('Не удалось импортировать')
  await expect(page.getByRole('textbox', { name: 'Название проекта' })).toHaveValue('Старый проект')
  await page.getByRole('button', { name: 'Закрыть вкладку Контекст' }).click()
  await expect(page.getByRole('heading', { name: 'Откройте диаграмму из дерева' })).toBeVisible()
  await page.getByRole('button', { name: 'Открыть корневую диаграмму' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
})

test('selection stays stable when adding, switching and clearing multiple nodes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /IDEF0/ }).click()
  await page.getByRole('button', { name: 'Создать контекстную диаграмму' }).click()
  const node = page.locator('.react-flow__node-idef0Function').first()
  await node.click({ position: { x: 20, y: 15 } })
  for (const role of ['Input', 'Control', 'Output', 'Mechanism']) {
    await page.getByRole('button', { name: role, exact: true }).click()
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1)
  }
  await expect(page.locator('.react-flow__node-idef0Function')).toHaveCount(1)
  await expect(page.locator('.react-flow__node-boundaryPort')).toHaveCount(4)
  await node.click({ position: { x: 20, y: 15 } })
  await page.locator('.react-flow__pane').click({ position: { x: 15, y: 15 } })
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  expect(errors).toEqual([])
})

test('edge zones create IDEF0 arrows and new names are placeholders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /IDEF0/ }).click()
  await page.getByRole('button', { name: 'Создать контекстную диаграмму' }).click()
  const input = page.getByRole('textbox', { name: 'Имя функции' })
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Название функции')
  await input.click()
  await input.pressSequentially('П')
  await expect(input).toHaveValue('П')
  await input.pressSequentially('иццерия')
  await input.press('Enter')
  await expect(page.locator('header [role=tablist]')).toBeVisible()
  await expect(page.locator('.idef0-sheet')).toHaveCount(0)
  const fn = page.locator('.react-flow__node-idef0Function')
  const draw = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 15 })
    await page.mouse.up()
  }
  const center = async (locator: ReturnType<typeof page.locator>) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Missing bounds')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  for (const role of ['Вход', 'Управление', 'Механизм']) {
    await draw(await center(page.getByRole('button', { name: `Граница: ${role}`, exact: true })), await center(fn))
  }
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  await draw(await center(fn.locator('[data-handleid="source-output"]')), await center(page.getByRole('button', { name: 'Граница: Выход', exact: true })))
  await expect(page.locator('.react-flow__edge')).toHaveCount(4)
  const labels = page.getByRole('textbox', { name: 'Подпись стрелки на холсте', exact: true })
  const names = ['Ингредиенты', 'Рецептура', 'Повар', 'Пицца']
  for (let i = 0; i < 4; i++) {
    await expect(labels.nth(i)).toHaveValue('')
    await labels.nth(i).fill(names[i]!)
    await labels.nth(i).press('Enter')
  }
  await page.screenshot({ path: 'test-results/idef0-zones.png', fullPage: true })
  await page.locator('.react-flow__controls-zoomout').click()
  const canvas = await page.locator('.canvas-area').boundingBox()
  if (!canvas) throw new Error('Missing canvas')
  for (const anchor of await page.locator('.react-flow__node-boundaryPort').all()) {
    const box = await anchor.boundingBox()
    if (!box) throw new Error('Missing anchor')
    const distances = [Math.abs(box.x + box.width / 2 - canvas.x - 18), Math.abs(box.x + box.width / 2 - canvas.x - canvas.width + 18), Math.abs(box.y + box.height / 2 - canvas.y - 18), Math.abs(box.y + box.height / 2 - canvas.y - canvas.height + 18)]
    expect(Math.min(...distances)).toBeLessThan(2)
  }
  expect(errors).toEqual([])
})
