# GitHub Developer Explorer

Aplicação para pesquisar perfis e explorar repositórios públicos do GitHub, desenvolvida com React e Vite.

**[Acessar o projeto online](https://github-dev-explorer-orpin.vercel.app/)**

## Funcionalidades

- Busca de perfis com informações públicas do GitHub.
- URLs compartilháveis para cada perfil: `/user/:username`.
- Listagem de repositórios com descrição, linguagem, estrelas, forks e data de atualização.
- Filtro por linguagem, incluindo repositórios sem linguagem informada.
- Ordenação por atualização, estrelas ou nome.
- Paginação local com 10 repositórios por página.
- Carregamento de novos lotes, sem duplicar repositórios, com nova tentativa em caso de erro.
- Estados de carregamento e mensagens de erro.
- Cancelamento de buscas ao sair da página.
- Interface responsiva com controles identificados e mensagens acessíveis.

## Tecnologias

- React
- React Router
- Vite
- CSS
- GitHub REST API
- Vitest
- React Testing Library
- Oxlint
- Vercel

## Executar localmente

Com Node.js e npm instalados:

```bash
git clone https://github.com/ysales98/github-dev-explorer.git
cd github-dev-explorer
npm install
npm run dev
```

Abra o endereço exibido no terminal.

Não é necessário configurar variáveis de ambiente para a versão atual.

## Testes e validação

```bash
npm test
```

Executa os testes automatizados de interface e serviço.

```bash
npm run test:watch
```

Executa os testes em modo de acompanhamento.

```bash
npm run check
```

Executa a verificação de código, os testes e o build de produção.

Os testes usam respostas simuladas e não fazem consultas reais ao GitHub. Consulte [TESTING.md](./TESTING.md) para mais detalhes.

## Build de produção

```bash
npm run build
npm run preview
```

O build é gerado na pasta `dist`.

## Rotas

| Rota | Conteúdo |
|---|---|
| `/` | Página inicial de busca |
| `/user/:username` | Perfil e repositórios do usuário |

O arquivo `vercel.json` configura o acesso direto às rotas da aplicação na Vercel.

## Limitações atuais

- Os repositórios são carregados em lotes de até 100 pelo botão "Carregar mais repositórios". Um lote menor que 100 encerra a busca; totais múltiplos de 100 podem exigir uma consulta final vazia.
- O filtro, a ordenação e a paginação operam sobre os repositórios carregados.
- As consultas não autenticadas estão sujeitas aos limites da API do GitHub.
- Os testes automatizados não substituem a validação visual em navegador.

## Autor

[Yan Sales](https://github.com/ysales98)