import { test, expect } from '@playwright/test'

test.describe('Usability & Form Persistence (Viajes de agua)', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Vicky (módulo de materiales, rol "materiales")
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/login')
    await page.getByRole('button', { name: 'VICTORIA Módulo de agua' }).click()
    await expect(page).toHaveURL('/')
    await page.waitForFunction(() => localStorage.getItem('molinos_erp_session_v1') !== null)
  })

  test('should register a water trip, verify calculation, and assert local storage persistence after reload', async ({ page }) => {
    // Ir a la página de viajes de agua
    await page.goto('/materiales/viajes')
    await expect(page.locator('h1')).toContainText('Viajes de agua')

    // Contar registros antes de agregar uno nuevo
    const initialRows = await page.locator('table.data-table tbody tr').count()

    // Abrir el modal para registrar viaje
    await page.getByRole('button', { name: 'Registrar viaje' }).click()

    // Esperar a que el modal esté visible
    await expect(page.locator('.modal')).toBeVisible()

    // Validar formulario - Verificar que los campos requeridos tengan el atributo 'required'
    await expect(page.getByLabel('Valor por viaje')).toHaveAttribute('required', '')
    await expect(page.getByLabel('Cantidad de viajes')).toHaveAttribute('required', '')
    await expect(page.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit')
    await expect(page.getByRole('button', { name: 'Guardar' })).toHaveAttribute('form', 'viajes-agua-form')

    // Llenar campos con valores válidos
    await page.getByLabel('Valor por viaje').fill('150000')
    await page.getByLabel('Cantidad de viajes').fill('5')
    await page.getByLabel('Adelanto ACPM').fill('50000')

    // Verificar que la vista previa del cálculo sea correcta
    const previewBox = page.locator('.callout')
    await expect(previewBox).toBeVisible()
    // El neto debería ser 150000 * 5 - 50000 = 700000
    await expect(previewBox).toContainText('700.000')

    // Guardar
    await page.getByRole('button', { name: 'Guardar' }).click()

    // El modal debería cerrarse
    await expect(page.locator('.modal')).not.toBeVisible()

    // Verificar que la tabla tenga un nuevo registro
    const currentRows = await page.locator('table.data-table tbody tr').count()
    expect(currentRows).toBe(initialRows + 1)

    // Verificar que el registro aparezca en la primera fila de la tabla con los datos correctos
    const firstRow = page.locator('table.data-table tbody tr').first()
    await expect(firstRow).toContainText('5') // Cantidad de viajes
    await expect(firstRow).toContainText('150.000') // Valor por viaje
    await expect(firstRow).toContainText('50.000') // ACPM
    await expect(firstRow).toContainText('700.000') // Neto

    // Recargar la página para verificar la persistencia en LocalStorage
    await page.reload()
    await expect(page.locator('h1')).toContainText('Viajes de agua')

    // La tabla debería seguir conteniendo el registro creado
    const postReloadRows = await page.locator('table.data-table tbody tr').count()
    expect(postReloadRows).toBe(initialRows + 1)

    const firstRowPostReload = page.locator('table.data-table tbody tr').first()
    await expect(firstRowPostReload).toContainText('700.000')
  })
})
