# 📱 KG AGROPET — Guia de Manutenção e Publicação

Este documento descreve a arquitetura atual do app e os procedimentos de
manutenção. **Não contém (e nunca deve conter) senhas, chaves ou credenciais.**

---

## Arquitetura

| Camada | Serviço | Função |
|---|---|---|
| Banco de dados + autenticação | Supabase | Tabelas, RLS e login por e-mail e senha (Supabase Auth) |
| Código-fonte | GitHub | Este repositório (branch `main`) |
| Hospedagem | Vercel | Publica automaticamente a cada push → https://kg-agropet.vercel.app |

## Segurança (configuração atual)

- **Login via Supabase Auth** — não há tabela própria de usuários nem senhas no código.
- **RLS ativado em todas as tabelas** — a chave pública (`anon`) sozinha não lê
  nada; todo acesso exige sessão autenticada.
- **Perfis de acesso** (`admin` / `consulta`) ficam na tabela `perfis`, vinculada
  ao usuário do Auth pelo `id`.
- **Nunca** commitar chave `service_role`, senhas ou arquivos `.env`.
  A `service_role` ignora o RLS e não existe neste projeto por decisão de design.
- Sessão no app: temporária por padrão (sessionStorage); permanente apenas com
  "Lembrar de mim".

## Criar um novo usuário

1. Supabase → **Authentication → Users → Add user**.
2. Use senha forte e única — nunca senhas padrão ou documentadas.
3. Vincule o perfil na tabela `perfis` com o tipo `admin` ou `consulta`.

## Publicar alterações

1. Commit + push na branch `main`.
2. A Vercel publica automaticamente em https://kg-agropet.vercel.app.
3. Nos celulares, o app instalado (PWA) atualiza sozinho na próxima abertura.

## Estrutura dos arquivos

```
kg-agropet/
├── index.html          ← Telas do app
├── manifest.json       ← Configuração PWA
├── sw.js               ← Modo offline
├── css/
│   └── style.css       ← Visual (verde + dourado)
└── js/
    ├── supabase.js     ← Cliente Supabase (apenas chave anon pública)
    └── app.js          ← Lógica do app
```

---

*KG Agropet — Qualidade que alimenta* 🌿
