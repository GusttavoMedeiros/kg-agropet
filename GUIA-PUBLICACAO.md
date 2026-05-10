# 📱 KG AGROPET — GUIA DE PUBLICAÇÃO
### Do zero ao app instalado no celular

---

## VISÃO GERAL

Você vai precisar criar conta em dois serviços gratuitos:
- **Supabase** → banco de dados (onde ficam os produtos e usuários)
- **GitHub + Vercel** → onde o app fica hospedado na internet

Tempo estimado: 30 a 40 minutos seguindo este guia.

---

## PASSO 1 — Criar conta no Supabase (banco de dados)

1. Acesse: https://supabase.com
2. Clique em **"Start your project"**
3. Faça login com sua conta Google (mais rápido)
4. Clique em **"New project"**
5. Preencha:
   - **Name:** kg-agropet
   - **Database Password:** crie uma senha forte e anote
   - **Region:** South America (São Paulo)
6. Clique em **"Create new project"** e aguarde (2 minutos)

---

## PASSO 2 — Criar as tabelas no banco

Dentro do Supabase, clique em **"SQL Editor"** no menu lateral.
Cole e execute cada bloco abaixo separadamente:

### Tabela de Produtos:
```sql
CREATE TABLE produtos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          text NOT NULL,
  codigo        text,
  categoria     text NOT NULL,
  preco_compra  numeric(10,2) NOT NULL DEFAULT 0,
  preco_venda   numeric(10,2) NOT NULL DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(),
  atualizado_por text
);
```

### Tabela de Usuários:
```sql
CREATE TABLE usuarios (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario text UNIQUE NOT NULL,
  senha   text NOT NULL,
  tipo    text NOT NULL CHECK (tipo IN ('admin', 'consulta'))
);
```

### Inserir os dois usuários iniciais:
```sql
-- Administrador (você)
INSERT INTO usuarios (usuario, senha, tipo)
VALUES ('admin', 'kg2026admin', 'admin');

-- Funcionário (consulta)
INSERT INTO usuarios (usuario, senha, tipo)
VALUES ('consulta', 'kg2026consulta', 'consulta');
```
⚠️ Anote essas senhas! Você pode alterar depois.

### Permitir acesso público (necessário para o app):
```sql
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico_produtos" ON produtos FOR ALL USING (true);
CREATE POLICY "acesso_publico_usuarios" ON usuarios FOR ALL USING (true);
```

---

## PASSO 3 — Pegar as chaves do Supabase

1. No Supabase, clique em **"Project Settings"** (ícone de engrenagem)
2. Clique em **"API"**
3. Copie:
   - **Project URL** → algo como `https://xyzxyz.supabase.co`
   - **anon public key** → uma chave longa

---

## PASSO 4 — Colocar as chaves no app

Abra o arquivo **`js/supabase.js`** e substitua:

```javascript
const SUPABASE_URL = 'COLE_SUA_URL_AQUI';
const SUPABASE_KEY = 'COLE_SUA_CHAVE_AQUI';
```

Pelo que você copiou no passo anterior. Exemplo:
```javascript
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## PASSO 5 — Publicar no GitHub

1. Acesse: https://github.com
2. Clique em **"Sign up"** e crie uma conta gratuita
3. Após o login, clique em **"New repository"**
4. Preencha:
   - **Repository name:** kg-agropet
   - Marque **"Public"**
5. Clique em **"Create repository"**
6. Na próxima tela, clique em **"uploading an existing file"**
7. Arraste TODOS os arquivos da pasta do app para lá
8. Clique em **"Commit changes"**

---

## PASSO 6 — Publicar no Vercel (hospedagem gratuita)

1. Acesse: https://vercel.com
2. Clique em **"Sign up"** → entre com sua conta GitHub
3. Clique em **"Add New Project"**
4. Selecione o repositório **kg-agropet**
5. Clique em **"Deploy"**
6. Aguarde 1 minuto
7. Você receberá um link como: `https://kg-agropet.vercel.app`

✅ Esse é o link do seu app! Ele funciona em qualquer celular.

---

## PASSO 7 — Instalar no celular como app

### Android (Chrome):
1. Abra o link no Chrome
2. Toque nos **3 pontinhos** no canto superior direito
3. Toque em **"Adicionar à tela inicial"**
4. Confirme — o app aparece como ícone na tela inicial

### iPhone (Safari):
1. Abra o link no Safari
2. Toque no ícone de **compartilhar** (quadrado com seta para cima)
3. Toque em **"Adicionar à Tela Inicial"**
4. Confirme

---

## PASSO 8 — Primeiro acesso

Abra o app e entre com:

| Tipo          | Usuário   | Senha           |
|---------------|-----------|-----------------|
| Administrador | admin     | kg2026admin     |
| Consulta      | consulta  | kg2026consulta  |

**Lembre de alterar as senhas depois!** Vá no Supabase → SQL Editor:
```sql
UPDATE usuarios SET senha = 'nova_senha_aqui' WHERE usuario = 'admin';
```

---

## RESUMO DOS ARQUIVOS

```
kg-agropet/
├── index.html          ← Telas do app
├── manifest.json       ← Configuração PWA
├── sw.js               ← Modo offline
├── css/
│   └── style.css       ← Visual (verde + dourado)
└── js/
    ├── supabase.js     ← Banco de dados ⚠️ coloque suas chaves aqui
    └── app.js          ← Toda a lógica do app
```

---

## SUPORTE

Se travar em algum passo, anote onde parou e me chame.
Posso ajudar com qualquer etapa do processo.

---

*KG Agropet — Qualidade que alimenta* 🌿
