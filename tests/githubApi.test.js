// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { getUser, getUserRepositories } from '../src/services/githubApi'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

it('normaliza o login e retorna o perfil', async () => {
  fetch.mockResolvedValue(new Response(JSON.stringify({ login: 'alice' })))
  await expect(getUser(' alice ')).resolves.toEqual({ login: 'alice' })
  expect(fetch).toHaveBeenCalledWith('https://api.github.com/users/alice', expect.objectContaining({
    headers: { Accept: 'application/vnd.github+json' }, signal: expect.any(AbortSignal),
  }))
})

it('codifica o login e mantém o limite de 100 repositórios', async () => {
  fetch.mockResolvedValue(new Response('[]'))
  await expect(getUserRepositories('a/b')).resolves.toEqual([])
  expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/a%2Fb/repos?per_page=100')
})

it('rejeita uma busca vazia sem acessar a rede', async () => {
  await expect(getUser('  ')).rejects.toThrow('Digite um usuário')
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  [404, {}, 'Usuário não encontrado'],
  [429, {}, 'Limite de consultas'],
  [403, { 'x-ratelimit-remaining': '0' }, 'Limite de consultas'],
  [403, { 'retry-after': '60' }, 'Limite de consultas'],
  [403, {}, 'O GitHub não conseguiu'],
  [500, {}, 'O GitHub não conseguiu'],
])('trata HTTP %s com cabeçalhos %j', async (status, headers, message) => {
  fetch.mockResolvedValue(new Response('{}', { status, headers }))
  await expect(getUser('alice')).rejects.toThrow(message)
})

it('distingue falha de conexão de timeout', async () => {
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(getUser('alice')).rejects.toThrow('Verifique sua conexão')
  fetch.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'))
  await expect(getUser('alice')).rejects.toThrow('A busca demorou demais')
})

it('propaga cancelamento ao fetch sem convertê-lo em falha de conexão', async () => {
  const controller = new AbortController()
  fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const pending = getUser('alice', controller.signal)
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await assertion
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
})
it('busca o segundo lote de repositórios', async () => {
  const repos = [{ id: 101, name: 'outro-repositorio' }]
  fetch.mockResolvedValue(new Response(JSON.stringify(repos)))

  await expect(
    getUserRepositories('alice', undefined, 2)
  ).resolves.toEqual(repos)

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/users/alice/repos?per_page=100&page=2'),
    expect.objectContaining({
      signal: expect.any(AbortSignal),
    }),
  )
})