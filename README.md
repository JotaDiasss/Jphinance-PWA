# Jphinance PWA

Versão web independente do Jphinance para iPhone, em português. Sem dependências de build.

## Executar localmente

```sh
python3 -m http.server 8080
```

Abra http://localhost:8080. Para instalar no iPhone, publique estes arquivos estáticos em um endereço HTTPS (por exemplo, GitHub Pages). Abra o endereço no Safari e use Compartilhar → Adicionar à Tela de Início. O primeiro acesso deve estar online para instalar o cache. Em atualizações, altere a versão do cache em `sw.js`.

## Sincronização

Em Ajustes, cole o mesmo link privado do Mac (`https://domínio/parear#chave`). A aplicação usa o protocolo existente: HKDF-SHA256, AES-GCM, revisões e mesclagem por relógio/dispositivo. O serviço `/sync` precisa permitir requisições CORS do endereço HTTPS do PWA se estiver hospedado em outro domínio. Não foi possível confirmar a disponibilidade do serviço usando o pacote 1.0, que não inclui `JphinanceSyncHost`.

Os registros e a chave ficam no armazenamento local do navegador; a chave não deve ser incluída no repositório nem compartilhada. Limpar os dados do site pode remover registros que ainda não foram sincronizados. O servidor recebe um token derivado e os registros cifrados. A sincronização é acionada quando o aplicativo abre, volta ao primeiro plano, recupera a conexão ou salva uma alteração.

## Arquivos

- `src/ui/`: interface responsiva e operações apresentadas ao usuário.
- `src/domain/ledger.js`: formato do Mac, regras financeiras, recorrências e mesclagem.
- `src/services/`: persistência local e protocolo criptografado.
- `manifest.json`, `sw.js`, `assets/`: instalação na tela inicial e cache offline.
- `tests/`: testes automatizados (`npm test`).
- `.github/workflows/pages.yml`: publicação automática no GitHub Pages.

Não há dados financeiros pessoais nem chave privada incluídos neste projeto.
