import { describe, expect, it } from 'vitest'
import { checkoutBranch, cloneRepo, isAllowedRemoteUrl, mergeBranch, rebaseBranch } from './gitActions'

// Estas pruebas cubren la validación de entrada añadida tras una auditoría de
// seguridad: un valor que empieza por '-' (checkout/merge/rebase) o que no
// tiene forma de URL real (clone) se rechaza ANTES de tocar git o el
// filesystem, así que no hacen falta repos reales — solo comprobar el
// resultado de error. Caso real confirmado con un PoC antes de este fix:
// 'rebaseBranch(repo, "--exec=<comando>")' ejecutaba de verdad el comando en
// cualquier repo con una rama con upstream configurado.
describe('validación de nombres de rama (checkout/merge/rebase)', () => {
  it('rechaza un nombre de rama que empieza por "-" en checkoutBranch', async () => {
    const result = await checkoutBranch('/no/importa', '--orphan')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/inválido/)
  })

  it('rechaza un nombre de rama que empieza por "-" en mergeBranch', async () => {
    const result = await mergeBranch('/no/importa', '--upload-pack=touch /tmp/x')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/inválido/)
  })

  it('rechaza un "onto" que empieza por "-" en rebaseBranch (bloquea --exec=<comando>)', async () => {
    const result = await rebaseBranch('/no/importa', '--exec=touch /tmp/x;true')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/inválido/)
  })

  it('rechaza una cadena vacía como nombre de rama', async () => {
    const result = await checkoutBranch('/no/importa', '')
    expect(result.success).toBe(false)
  })
})

describe('isAllowedRemoteUrl (formato de URL para cloneRepo)', () => {
  it('acepta https://', () => {
    expect(isAllowedRemoteUrl('https://github.com/octocat/Hello-World.git')).toBe(true)
  })

  it('acepta git@', () => {
    expect(isAllowedRemoteUrl('git@github.com:octocat/Hello-World.git')).toBe(true)
  })

  it('rechaza un flag de git disfrazado de URL (--upload-pack=...)', () => {
    expect(isAllowedRemoteUrl('--upload-pack=touch /tmp/x;true')).toBe(false)
  })

  it('rechaza el transporte ext:: aunque no empiece por "-"', () => {
    expect(isAllowedRemoteUrl('ext::sh -c "touch /tmp/x"')).toBe(false)
  })

  it('rechaza una cadena vacía', () => {
    expect(isAllowedRemoteUrl('')).toBe(false)
  })
})

describe('cloneRepo rechaza URLs con formato inválido antes de tocar red o disco', () => {
  it('devuelve error sin lanzar para --upload-pack=...', async () => {
    const result = await cloneRepo('--upload-pack=touch /tmp/x;true')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/inválida/)
    expect(result.localPath).toBe('')
  })
})
