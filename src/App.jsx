import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router'
import { getUser, getUserRepositories } from './services/githubApi'
import './index.css'

const REPOSITORIES_PER_PAGE = 10

function Home() {
  return <Explorer />
}

function UserDetails() {
  const { username } = useParams()
  return <Explorer key={username} routeUsername={username} />
}

function Explorer({ routeUsername = '' }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const moreRequestRef = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [username, setUsername] = useState(routeUsername)
  const [status, setStatus] = useState(routeUsername ? 'loading' : 'idle')
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [repositories, setRepositories] = useState([])
  const [language, setLanguage] = useState('')
  const [repositoryQuery, setRepositoryQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('updated')
  const [page, setPage] = useState(1)
  const [repositoryApiPage, setRepositoryApiPage] = useState(1)
  const [hasMoreRepositories, setHasMoreRepositories] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const isLoading = status === 'loading'
  const languages = [...new Set(repositories.map((repository) => repository.language).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const hasUnknownLanguage = repositories.some((repository) => !repository.language)
  const normalizedQuery = repositoryQuery.trim().toLocaleLowerCase('pt-BR')
  const filteredRepositories = repositories
    .filter((repository) => repository.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
    .filter((repository) => !language || (repository.language || '__unknown__') === language)
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      if (sortOrder === 'stars') return b.stargazers_count - a.stargazers_count || byName
      if (sortOrder === 'name') return byName
      return new Date(b.updated_at) - new Date(a.updated_at) || byName
    })

  const totalPages = Math.max(1, Math.ceil(filteredRepositories.length / REPOSITORIES_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const firstIndex = (currentPage - 1) * REPOSITORIES_PER_PAGE
  const visibleRepositories = filteredRepositories.slice(firstIndex, firstIndex + REPOSITORIES_PER_PAGE)

  useEffect(() => {
    if (!routeUsername) {
      inputRef.current?.focus()
      return
    }

    const controller = new AbortController()
    document.title = `@${routeUsername} | GitHub Developer Explorer`

    Promise.all([
      getUser(routeUsername, controller.signal),
      getUserRepositories(routeUsername, controller.signal),
    ]).then(([profile, repos]) => {
      if (controller.signal.aborted) return
      setUser(profile)
      setRepositories(repos)
      setHasMoreRepositories(repos.length === 100)
      setStatus('success')
    }).catch((error) => {
      if (controller.signal.aborted) return
      setError(error.message || 'Não foi possível buscar o perfil e os repositórios. Tente novamente.')
      setStatus('error')
    })

    return () => {
      controller.abort()
      moreRequestRef.current?.abort()
      moreRequestRef.current = null
      document.title = 'GitHub Developer Explorer'
    }
  }, [routeUsername, attempt])

  function handleSearch(event) {
    event.preventDefault()
    if (isLoading) return
    moreRequestRef.current?.abort()
    moreRequestRef.current = null
    setIsLoadingMore(false)
    setLoadMoreError('')
    const login = username.trim()
    if (!login) {
      setError('Digite um usuário do GitHub para buscar.')
      setStatus('error')
      inputRef.current?.focus()
      return
    }
    if (login === routeUsername) {
      setStatus('loading')
      setError('')
      setUser(null)
      setRepositories([])
      setLanguage('')
      setRepositoryQuery('')
      setSortOrder('updated')
      setPage(1)
      setRepositoryApiPage(1)
      setHasMoreRepositories(false)
      setAttempt((value) => value + 1)
    } else {
      navigate(`/user/${encodeURIComponent(login)}`)
    }
  }

  async function handleLoadMore() {
    if (status !== 'success' || !hasMoreRepositories || moreRequestRef.current) return

    const controller = new AbortController()
    moreRequestRef.current = controller
    const nextApiPage = repositoryApiPage + 1
    setIsLoadingMore(true)
    setLoadMoreError('')

    try {
      const nextRepositories = await getUserRepositories(routeUsername, controller.signal, nextApiPage)
      if (controller.signal.aborted) return

      setRepositories((current) => {
        const byId = new Map(current.map((repository) => [repository.id, repository]))
        for (const repository of nextRepositories) byId.set(repository.id, repository)
        return [...byId.values()]
      })
      setRepositoryApiPage(nextApiPage)
      setHasMoreRepositories(nextRepositories.length === 100)
    } catch (error) {
      if (controller.signal.aborted) return
      setLoadMoreError(error.message || 'Não foi possível carregar mais repositórios. Tente novamente.')
    } finally {
      if (moreRequestRef.current === controller) {
        moreRequestRef.current = null
        setIsLoadingMore(false)
      }
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">GitHub Developer Explorer</p>

        <h1>Explore desenvolvedores e repositórios do GitHub.</h1>

        <p className="description">
          Pesquise perfis, analise repositórios públicos e descubra
          informações diretamente pela GitHub REST API.
        </p>

        {routeUsername && (
          <nav className="back-navigation" aria-label="Navegação principal">
            <Link to="/">← Voltar à busca</Link>
          </nav>
        )}

        <form className="search-form" onSubmit={handleSearch} aria-busy={isLoading}>
          <input
            ref={inputRef}
            type="text"
            aria-invalid={status === 'error' && !username.trim() ? true : undefined}
            placeholder="Digite um usuário do GitHub"
            aria-label="Usuário do GitHub"
            aria-describedby={status === 'error' ? 'search-error' : undefined}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isLoading}
            autoCapitalize="none"
            spellCheck={false}
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        <div role="status" aria-live="polite">
          {isLoading && <p className="search-message">Buscando perfil e repositórios no GitHub…</p>}
          {status === 'success' && <p className="search-message">Perfil de @{user.login} encontrado.</p>}
        </div>
        {status === 'error' && <p id="search-error" className="search-message search-error" role="alert">{error}</p>}

        {status === 'success' && user && (
          <article className="profile-card" aria-labelledby="profile-name">
            <div className="profile-heading">
              <img className="profile-avatar" src={user.avatar_url} alt={`Avatar de ${user.login}`} width="88" height="88" />
              <div>
                <h2 id="profile-name">{user.name || user.login}</h2>
                <a href={user.html_url} target="_blank" rel="noopener noreferrer">@{user.login} ↗</a>
              </div>
            </div>
            <p className="profile-bio">{user.bio || 'Este usuário ainda não adicionou uma biografia.'}</p>
            {user.location && <p className="profile-location">Localização: {user.location}</p>}
            <dl className="profile-stats">
              <div><dt>Repositórios públicos</dt><dd>{user.public_repos.toLocaleString('pt-BR')}</dd></div>
              <div><dt>Seguidores</dt><dd>{user.followers.toLocaleString('pt-BR')}</dd></div>
              <div><dt>Seguindo</dt><dd>{user.following.toLocaleString('pt-BR')}</dd></div>
            </dl>
          </article>
        )}
        {status === 'success' && user && (
          <section className="repositories" aria-labelledby="repositories-title">
            <h2 id="repositories-title">Repositórios públicos</h2>
            <p className="search-message" role="status" aria-live="polite" aria-atomic="true">
              Repositórios carregados: {repositories.length.toLocaleString('pt-BR')}.
              {isLoadingMore && ' Carregando mais repositórios…'}
            </p>
            {hasMoreRepositories && (
              <div className="repository-pagination">
                <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} aria-controls="repository-list">
                  {isLoadingMore ? 'Carregando…' : loadMoreError ? 'Tentar novamente' : 'Carregar mais repositórios'}
                </button>
              </div>
            )}
            {loadMoreError && <p className="search-message search-error" role="alert">{loadMoreError}</p>}
            {repositories.length > 0 && (
              <p id="repository-search-help" className="search-message">O filtro e a ordenação consideram os repositórios carregados. A busca por nome também considera apenas esses resultados.</p>
            )}
            {repositories.length === 0 ? (
              <p className="search-message">Este usuário ainda não possui repositórios públicos.</p>
            ) : (
              <>
                <div className="repository-control repository-search">
                  <label htmlFor="repository-search">Buscar repositório</label>
                  <input
                    id="repository-search"
                    type="search"
                    placeholder="Digite parte do nome"
                    value={repositoryQuery}
                    onChange={(event) => { setRepositoryQuery(event.target.value); setPage(1) }}
                    aria-controls="repository-list"
                    aria-describedby="repository-search-help"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <div className="repository-controls">
                  <div className="repository-control">
                    <label htmlFor="repository-language">Linguagem</label>
                    <select id="repository-language" value={language} onChange={(event) => { setLanguage(event.target.value); setPage(1) }} aria-controls="repository-list">
                      <option value="">Todas as linguagens</option>
                      {languages.map((item) => <option key={item} value={item}>{item}</option>)}
                      {hasUnknownLanguage && <option value="__unknown__">Não informada</option>}
                    </select>
                  </div>
                  <div className="repository-control">
                    <label htmlFor="repository-sort">Ordenar por</label>
                    <select id="repository-sort" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1) }} aria-controls="repository-list">
                      <option value="updated">Mais atualizados</option>
                      <option value="stars">Mais estrelas</option>
                      <option value="name">Nome A–Z</option>
                    </select>
                  </div>
                </div>
                <p className="search-message" role="status" aria-live="polite" aria-atomic="true">
                  {visibleRepositories.length.toLocaleString('pt-BR')} {visibleRepositories.length === 1 ? 'repositório exibido' : 'repositórios exibidos'} de {filteredRepositories.length.toLocaleString('pt-BR')}.
                  {totalPages > 1 && <> Página {currentPage} de {totalPages}.</>}
                  {filteredRepositories.length === 0 && (
                    <> Nenhum repositório carregado corresponde à busca e ao filtro selecionados.</>
                  )}

                </p>
                {totalPages > 1 && (
                  <nav className="repository-pagination" aria-label="Paginação dos repositórios">
                    <button type="button" aria-controls="repository-list" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      Anterior
                    </button>
                    <span>Página {currentPage} de {totalPages}</span>
                    <button type="button" aria-controls="repository-list" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                      Próxima
                    </button>
                  </nav>
                )}
                <ul id="repository-list" className="repository-list">
                  {visibleRepositories.map((repository) => (
                    <li key={repository.id}>
                      <article className="repository-card">
                        <h3>
                          <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
                            {repository.name} ↗
                          </a>
                        </h3>
                        <p className="repository-description">{repository.description || 'Sem descrição disponível.'}</p>
                        <dl className="repository-stats">
                          <div><dt>Linguagem principal</dt><dd>{repository.language || 'Não informada'}</dd></div>
                          <div><dt>Stars</dt><dd>{repository.stargazers_count.toLocaleString('pt-BR')}</dd></div>
                          <div><dt>Forks</dt><dd>{repository.forks_count.toLocaleString('pt-BR')}</dd></div>
                          <div>
                            <dt>Última atualização</dt>
                            <dd><time dateTime={repository.updated_at}>{new Date(repository.updated_at).toLocaleDateString('pt-BR')}</time></dd>
                          </div>
                        </dl>
                      </article>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/user/:username" element={<UserDetails />} />
      <Route path="*" element={
        <main className="app">
          <section className="hero">
            <h1>Página não encontrada.</h1>
            <nav className="back-navigation" aria-label="Navegação principal">
              <Link to="/">Voltar à busca</Link>
            </nav>
          </section>
        </main>
      } />
    </Routes>
  )
}

export default App
