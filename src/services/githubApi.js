const API_URL = 'https://api.github.com'

async function requestUserResource(username, resource = '', signal) {
  const login = username.trim()

  if (!login) {
    throw new Error('Digite um usuário do GitHub para buscar.')
  }

  let response
  try {
    response = await fetch(`${API_URL}/users/${encodeURIComponent(login)}${resource}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (error.name === 'TimeoutError') {
      throw new Error('A busca demorou demais. Tente novamente.')
    }
    throw new Error('Não foi possível conectar ao GitHub. Verifique sua conexão e tente novamente.')
  }

  if (response.status === 404) {
    throw new Error('Usuário não encontrado. Confira o nome e tente novamente.')
  }
  if (response.status === 429 || (response.status === 403 && (
    response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')
  ))) {
    throw new Error('Limite de consultas ao GitHub atingido. Aguarde alguns minutos e tente novamente.')
  }
  if (!response.ok) {
    throw new Error('O GitHub não conseguiu concluir a busca. Tente novamente mais tarde.')
  }

  return response.json()
}

export function getUser(username, signal) {
  return requestUserResource(username, '', signal)
}

export function getUserRepositories(username, signal, page = 1) {
  const resource = page === 1
    ? '/repos?per_page=100'
    : `/repos?per_page=100&page=${page}`

  return requestUserResource(username, resource, signal)
}