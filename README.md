# Usina São Lucas — Sistema de Gestão

Painel responsivo para controle mensal de produção de arroz, estoque e movimentações financeiras.

## O que funciona agora

- Interface adaptada para computador e celular.
- Login de demonstração: usuário `martins`, senha `bubbles`.
- Registro de produção diária e metas.
- Cadastro de itens do estoque e alertas de estoque baixo.
- Registro de receitas/vendas e despesas.
- Resumo mensal, comparação com meta e exportação CSV.
- Sem configuração de backend, os dados ficam apenas no navegador usado (modo de demonstração).

## Importante antes de publicar

O modo de demonstração **não é seguro para publicar como sistema privado**: o login está no JavaScript e os dados ficam no armazenamento local do navegador. Para compartilhar dados entre dispositivos, configure o Supabase abaixo. Não publique a versão de demonstração como se fosse protegida.

## Configurar banco de dados online com Supabase

1. Crie um projeto em https://supabase.com/.
2. No painel do projeto, abra **SQL Editor** e execute todo o conteúdo de `supabase-schema.sql`.
3. Em **Project Settings → API**, copie a Project URL e a chave `anon`/publishable.
4. Abra `app.js` e preencha as duas constantes no início:

   ```js
   const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";
   ```

   Use somente a chave pública anon/publishable no site. **Nunca coloque `service_role` ou segredo administrativo no JavaScript.**
5. Configure a autenticação do Supabase para aceitar e-mail/senha. Este projeto usa o nome de usuário como identificador, transformando `martins` em `martins@usinasl.local`. Para criar o primeiro usuário, é necessário criar essa conta no Supabase Auth com a senha desejada. Dependendo das configurações do projeto, será preciso desativar a confirmação de e-mail para esse identificador interno ou adotar um fluxo de convite compatível. Faça isso antes de publicar.
6. O banco possui políticas RLS para que cada usuário autenticado veja e altere apenas os próprios registros.
7. Abra `index.html` com um servidor local (por exemplo, extensão Live Server no VS Code) para testar.

## Publicar

GitHub Pages pode hospedar os arquivos estáticos. Depois de configurar o Supabase, envie os arquivos do projeto ao GitHub e ative Pages em Settings → Pages. Como o navegador acessa o Supabase diretamente, os dados sincronizam entre dispositivos após login. Proteja o projeto Supabase e teste permissões antes de usar com dados reais.

## Limitações desta primeira versão

- As quantidades de estoque são editadas por cadastro inicial; entradas/saídas de estoque e baixa automática por produção podem ser adicionadas em uma próxima versão.
- Não há edição de registros existentes ainda; exclusão está disponível.
- Os campos de produção são genéricos para arroz em casca, beneficiado e embalado; adapte as etapas à operação real.
- O relatório financeiro é um resumo gerencial, não substitui contabilidade.
