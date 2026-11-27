# Estrutura do PWA

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Entrada e estrutura da página |
| `src/ui/` | Telas, eventos e estilos |
| `src/domain/` | Regras financeiras e formato do ledger |
| `src/services/` | Armazenamento e criptografia da sincronização |
| `assets/` | Ícones e imagens publicados |
| `manifest.json`, `sw.js` | Instalação e cache offline |
| `tests/` | Verificação das regras e do protocolo |
| `.github/workflows/pages.yml` | Testes e publicação no GitHub Pages |

O site é estático: `index.html` e `sw.js` usam caminhos relativos à raiz. Ao mover código ou recursos, atualize as importações, a lista `ASSETS` do service worker, a cópia de arquivos no workflow e a versão `CACHE`. Execute `npm test` antes de publicar. O arquivo `dist/` local é gerado e ignorado pelo Git.

O aplicativo Mac está em [Jphinance](https://github.com/JotaDiasss/Jphinance). Os dois compartilham o formato de dados e o protocolo de sync, mas têm interfaces e formas de distribuição próprias.
