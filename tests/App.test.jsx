import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../src/App'
import { getUser, getUserRepositories } from '../src/services/githubApi'

vi.mock('../src/services/githubApi', () => ({ getUser: vi.fn(), getUserRepositories: vi.fn() }))

const repositories = Array.from({ length: 21 }, (_, index) => ({
  id: index + 1, name: `repo-${String(index + 1).padStart(2, '0')}`,
  language: index < 12 ? 'JavaScript' : index === 20 ? null : 'Python',
  stargazers_count: 21 - index, forks_count: 0,
  updated_at: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
  html_url: `https://github.com/alice/repo-${index + 1}`, description: null,
}))
const profile = (login) => ({ login, name: login, avatar_url: 'https://example.com/avatar.png',
  html_url: `https://github.com/${login}`, public_repos: 21, followers: 2, following: 1 })

beforeEach(() => {
  vi.resetAllMocks()
  getUser.mockImplementation(async (login) => profile(login))
  getUserRepositories.mockResolvedValue(repositories)
  document.title = 'GitHub Developer Explorer'
})

function open(path = '/') {
  window.history.replaceState({}, '', path)
  render(<BrowserRouter><App /></BrowserRouter>)
  return userEvent.setup()
}
const loaded = (login = 'alice') => screen.findByRole('heading', { name: login, exact: true })
const next = () => screen.getByRole('button', { name: 'Próxima' })
const previous = () => screen.getByRole('button', { name: 'Anterior' })
const pager = () => screen.getByRole('navigation', { name: 'Paginação dos repositórios' })
const cards = () => screen.getAllByRole('listitem')

it('rejeita busca vazia com alerta e foco, sem consultar a API', async () => {
  const user = open()
  await user.click(screen.getByRole('button', { name: 'Buscar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Digite um usuário')
  expect(screen.getByRole('textbox')).toHaveFocus()
  expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  expect(getUser).not.toHaveBeenCalled()
})

it('busca por Enter, normaliza o login e navega para a URL do perfil', async () => {
  const user = open()
  await user.type(screen.getByRole('textbox'), ' alice {Enter}')
  await loaded()
  expect(window.location.pathname).toBe('/user/alice')
  expect(getUser).toHaveBeenCalledWith('alice', expect.any(AbortSignal))
  expect(getUserRepositories).toHaveBeenCalledWith('alice', expect.any(AbortSignal))
})

it('carrega um acesso direto e anuncia o loading até as duas respostas chegarem', async () => {
  let resolveRepos
  getUserRepositories.mockReturnValue(new Promise(resolve => { resolveRepos = resolve }))
  open('/user/alice')
  expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Buscando perfil')
  await act(async () => resolveRepos(repositories))
  await loaded()
  expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  expect(document.title).toBe('@alice | GitHub Developer Explorer')
})

it('permite tentar novamente o mesmo perfil após um erro', async () => {
  getUser.mockRejectedValueOnce(new Error('Usuário não encontrado.'))
  const user = open('/user/alice')
  expect(await screen.findByRole('alert')).toHaveTextContent('Usuário não encontrado')
  await user.click(screen.getByRole('button', { name: 'Buscar' }))
  await loaded()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(getUser).toHaveBeenCalledTimes(2)
})

it('exibe erro também quando apenas os repositórios falham', async () => {
  getUserRepositories.mockRejectedValueOnce(new Error('Limite de consultas atingido.'))
  open('/user/alice')
  expect(await screen.findByRole('alert')).toHaveTextContent('Limite de consultas')
  expect(screen.queryByRole('heading', { name: 'alice' })).not.toBeInTheDocument()
})

it('pagina sem repetir consultas e respeita os limites e o singular', async () => {
  const user = open('/user/alice')
  await loaded()
  expect(cards()).toHaveLength(10)
  expect(cards()[0]).toHaveTextContent('repo-21')
  expect(previous()).toBeDisabled()
  await user.click(next())
  expect(pager()).toHaveTextContent('Página 2 de 3')
  expect(cards()[0]).toHaveTextContent('repo-11')
  await user.click(next())
  expect(cards()).toHaveLength(1)
  expect(next()).toBeDisabled()
  expect(screen.getByText(/1 repositório exibido de 21/)).toBeInTheDocument()
  await user.click(previous())
  expect(pager()).toHaveTextContent('Página 2 de 3')
  expect(getUserRepositories).toHaveBeenCalledTimes(1)
})

it('filtra antes de paginar, reinicia a página e inclui linguagem não informada', async () => {
  const user = open('/user/alice')
  await loaded()
  await user.click(next())
  await user.selectOptions(screen.getByLabelText('Linguagem'), 'JavaScript')
  expect(pager()).toHaveTextContent('Página 1 de 2')
  expect(cards()).toHaveLength(10)
  await user.click(next())
  expect(cards()).toHaveLength(2)
  await user.selectOptions(screen.getByLabelText('Linguagem'), '__unknown__')
  expect(cards()).toHaveLength(1)
  expect(cards()[0]).toHaveTextContent('repo-21')
  expect(screen.queryByRole('navigation', { name: 'Paginação dos repositórios' })).not.toBeInTheDocument()
  expect(getUserRepositories).toHaveBeenCalledTimes(1)
})

it.each(['name', 'stars'])('ordena todos os resultados por %s e volta à primeira página', async (order) => {
  const user = open('/user/alice')
  await loaded()
  await user.click(next())
  await user.selectOptions(screen.getByLabelText('Ordenar por'), order)
  expect(pager()).toHaveTextContent('Página 1 de 3')
  expect(within(cards()[0]).getByRole('link')).toHaveTextContent('repo-01')
  await user.click(next())
  expect(within(cards()[0]).getByRole('link')).toHaveTextContent('repo-11')
  expect(getUserRepositories).toHaveBeenCalledTimes(1)
})

it.each([0, 1, 10])('não mostra paginação para %i repositórios', async (count) => {
  getUser.mockResolvedValue({ ...profile('alice'), public_repos: count })
  getUserRepositories.mockResolvedValue(repositories.slice(0, count))
  open('/user/alice')
  await loaded()
  expect(screen.queryAllByRole('listitem')).toHaveLength(count)
  expect(screen.queryByRole('navigation', { name: 'Paginação dos repositórios' })).not.toBeInTheDocument()
  if (!count) expect(screen.getByText('Este usuário ainda não possui repositórios públicos.')).toBeInTheDocument()
})

it('informa quando a lista está limitada aos repositórios carregados', async () => {
  getUser.mockResolvedValue({ ...profile('alice'), public_repos: 150 })
  open('/user/alice')
  await loaded()
  expect(screen.getByText(/exibimos até 100 nesta versão/)).toBeInTheDocument()
})

it('reinicia filtros, ordenação e página ao pesquisar outro perfil', async () => {
  const user = open('/user/alice')
  await loaded()
  await user.selectOptions(screen.getByLabelText('Linguagem'), 'JavaScript')
  await user.selectOptions(screen.getByLabelText('Ordenar por'), 'name')
  await user.click(next())
  await user.clear(screen.getByRole('textbox'))
  await user.type(screen.getByRole('textbox'), 'bob{Enter}')
  await loaded('bob')
  expect(window.location.pathname).toBe('/user/bob')
  expect(screen.getByLabelText('Linguagem')).toHaveValue('')
  expect(screen.getByLabelText('Ordenar por')).toHaveValue('updated')
  expect(pager()).toHaveTextContent('Página 1 de 3')
})

it('cancela a busca ao voltar e ignora respostas atrasadas', async () => {
  let resolveProfile
  getUser.mockReturnValue(new Promise(resolve => { resolveProfile = resolve }))
  const user = open('/user/alice')
  const signal = getUser.mock.calls[0][1]
  await user.click(screen.getByRole('link', { name: /Voltar à busca/ }))
  expect(window.location.pathname).toBe('/')
  expect(signal.aborted).toBe(true)
  await act(async () => resolveProfile(profile('alice')))
  expect(screen.queryByRole('heading', { name: 'alice' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveFocus()
})

it('responde à navegação do histórico do navegador', async () => {
  open('/user/alice')
  await loaded()
  await act(async () => {
    window.history.pushState({}, '', '/user/bob')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await loaded('bob')
  expect(screen.queryByRole('heading', { name: 'alice' })).not.toBeInTheDocument()
})

it('oferece retorno à busca para uma rota inexistente', async () => {
  const user = open('/nao-existe')
  expect(screen.getByRole('heading', { name: 'Página não encontrada.' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Voltar à busca' }))
  expect(window.location.pathname).toBe('/')
  expect(getUser).not.toHaveBeenCalled()
})
