import { test, expect } from '@playwright/test'

test.describe('Login Flow & Usability', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage antes de cada prueba
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/login')
  })

  test('should login via quick access card (Admin)', async ({ page }) => {
    // Hacer clic en la tarjeta ADMIN
    await page.getByRole('button', { name: 'ADMIN David — Panel completo' }).click()

    // Debería redirigir a / (su dashboard por rol)
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('Panel de administración')

    // Ir a Calendario de planta y verificar que carga
    await page.getByRole('link', { name: 'Calendario de planta' }).click()
    await expect(page).toHaveURL('/planta/calendario')
    await expect(page.locator('h1')).toContainText('Calendario de planta')
  })

  test('should login via quick access card (Victoria - Water module)', async ({ page }) => {
    // Hacer clic en la tarjeta VICTORIA
    await page.getByRole('button', { name: 'VICTORIA Módulo de agua' }).click()

    // Debería redirigir a / (su dashboard por rol) y tener acceso al módulo
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('Hola, Vicky')
  })

  test('should login via credentials form (Form Mode)', async ({ page }) => {
    // Cambiar al modo formulario
    await page.getByRole('button', { name: 'Acceder con correo y contraseña' }).click()

    // Llenar campos
    await page.getByLabel('Correo electrónico').fill('david@molinosdecolombia.com')
    await page.getByLabel('Contraseña').fill('molinos2026')

    // Enviar
    await page.getByRole('button', { name: 'Ingresar' }).click()

    // Debería entrar al Dashboard principal
    await expect(page).toHaveURL('/')
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // Cambiar al modo formulario
    await page.getByRole('button', { name: 'Acceder con correo y contraseña' }).click()

    // Llenar con datos incorrectos
    await page.getByLabel('Correo electrónico').fill('correo@incorrecto.com')
    await page.getByLabel('Contraseña').fill('claveerronea')

    // Enviar
    await page.getByRole('button', { name: 'Ingresar' }).click()

    // Debería mostrar mensaje de error
    const errorAlert = page.locator('[role="alert"]')
    await expect(errorAlert).toBeVisible()
    await expect(errorAlert).toContainText('No existe una cuenta con ese correo')
  })

  test('usability: should support keyboard navigation and form submission', async ({ page }) => {
    // Cambiar al modo formulario
    await page.getByRole('button', { name: 'Acceder con correo y contraseña' }).click()

    // Enfocar el primer input (debería tener autoFocus)
    await expect(page.getByLabel('Correo electrónico')).toBeFocused()

    // Llenar por teclado y usar Tab para avanzar
    await page.keyboard.type('david@molinosdecolombia.com')
    await page.keyboard.press('Tab')

    // Ahora la contraseña debería estar enfocada
    await expect(page.getByLabel('Contraseña')).toBeFocused()
    await page.keyboard.type('molinos2026')

    // Enviar presionando Enter desde el input de contraseña
    await page.keyboard.press('Enter')

    // Debería entrar exitosamente
    await expect(page).toHaveURL('/')
  })
})
