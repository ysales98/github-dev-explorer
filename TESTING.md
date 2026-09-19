# Testes automatizados

Execute os comandos na pasta do projeto, após `npm install`:

```sh
npm test
npm run test:watch
npm run check
```

- `npm test`: executa toda a suíte uma vez e termina com erro se algum teste falhar.
- `npm run test:watch`: acompanha alterações durante o desenvolvimento.
- `npm run check`: executa lint, testes e build, interrompendo na primeira falha.

## Organização

- `tests/App.test.jsx`: testes de interação com React Testing Library, BrowserRouter e jsdom. Verificam busca, loading, erros, rotas, cancelamento, filtros, ordenação e paginação.
- `tests/githubApi.test.js`: testes do serviço em ambiente Node, com fetch simulado. Verificam URLs, respostas, erros HTTP, conexão, timeout e cancelamento.
- `tests/setup.js`: matchers de DOM e limpeza entre testes.
- `vitest.config.js`: reutiliza a configuração do Vite e configura o ambiente de testes.

Os testes não consultam o GitHub. As respostas simuladas tornam a execução independente de internet, dados de perfis e limites de consulta. A suíte não substitui uma verificação visual em navegador nem uma consulta real à API. Não há medição de cobertura percentual nesta etapa.

A paginação atual divide em grupos de 10 os até 100 repositórios carregados. Filtro e ordenação são locais e precedem a paginação. Os testes preservam esse comportamento.

Referências: [Vitest](https://vitest.dev/guide/) e [React Testing Library](https://testing-library.com/docs/react-testing-library/setup/).
