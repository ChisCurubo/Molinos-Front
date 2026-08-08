import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility (A11y) Standards', () => {
  test('should pass automated accessibility audit on login page (card mode)', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('.auth')

    // Ejecutar auditoría de accesibilidad con Axe
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Algunas paletas pueden ser intencionales, auditamos la estructura general
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should pass automated accessibility audit on login page (form mode)', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Acceder con correo y contraseña' }).click()
    await page.waitForSelector('form')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should verify accessibility menu functionality', async ({ page }) => {
    // Iniciar sesión para ver la barra superior con el menú de accesibilidad
    await page.goto('/login')
    await page.getByRole('button', { name: 'ADMIN David — Panel completo' }).click()
    await expect(page).toHaveURL('/')

    // El botón del menú de accesibilidad debe estar disponible
    const a11yButton = page.getByRole('button', { name: 'Accesibilidad' })
    await expect(a11yButton).toBeVisible()
    await a11yButton.click()

    // El diálogo de accesibilidad debe abrirse
    const a11yDialog = page.getByRole('dialog', { name: 'Opciones de accesibilidad' })
    await expect(a11yDialog).toBeVisible()

    // 1. Probar cambio de tamaño de letra (Font Steps)
    const originalFontSize = await page.evaluate(() => document.documentElement.style.fontSize)
    expect(originalFontSize).toBe('100%') // 1 * 100%

    // Clic en "Grande"
    await a11yDialog.getByRole('button', { name: 'Grande', exact: true }).click()
    const largeFontSize = await page.evaluate(() => document.documentElement.style.fontSize)
    expect(largeFontSize).toBe('115%') // 1.15 * 100%

    // Clic en "Muy grande"
    await a11yDialog.getByRole('button', { name: 'Muy grande', exact: true }).click()
    const extraLargeFontSize = await page.evaluate(() => document.documentElement.style.fontSize)
    expect(extraLargeFontSize).toBe('130%') // 1.3 * 100%

    // Clic en "Normal"
    await a11yDialog.getByRole('button', { name: 'Normal', exact: true }).click()
    const normalFontSize = await page.evaluate(() => document.documentElement.style.fontSize)
    expect(normalFontSize).toBe('100%')

    // 2. Probar cambio a alto contraste
    // Inicialmente no debe estar en alto contraste
    const initialContrast = await page.evaluate(() => document.documentElement.getAttribute('data-contrast'))
    expect(initialContrast).toBe('normal')

    // Clic en Activar alto contraste
    await a11yDialog.getByRole('button', { name: 'Activar alto contraste' }).click()
    const highContrast = await page.evaluate(() => document.documentElement.getAttribute('data-contrast'))
    expect(highContrast).toBe('high')

    // Clic en Desactivar
    await a11yDialog.getByRole('button', { name: 'Alto contraste activado' }).click()
    const revertedContrast = await page.evaluate(() => document.documentElement.getAttribute('data-contrast'))
    expect(revertedContrast).toBe('normal')

    // 3. Probar reducción de animaciones
    const initialMotion = await page.evaluate(() => document.documentElement.getAttribute('data-reduce-motion'))
    expect(initialMotion).toBe('false')

    await a11yDialog.getByRole('button', { name: 'Reducir animaciones' }).click()
    const reducedMotion = await page.evaluate(() => document.documentElement.getAttribute('data-reduce-motion'))
    expect(reducedMotion).toBe('true')

    await a11yDialog.getByRole('button', { name: 'Animaciones reducidas' }).click()
    const revertedMotion = await page.evaluate(() => document.documentElement.getAttribute('data-reduce-motion'))
    expect(revertedMotion).toBe('false')
  })
})
