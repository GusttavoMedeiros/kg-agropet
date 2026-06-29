// ═══════════════════════════════════════════════
//  CONFIGURAÇÃO SUPABASE — KG AGROPET
//  Login seguro via Supabase Auth (e-mail + senha).
//  A chave pública (anon) NÃO lê mais as tabelas:
//  todo acesso passa por uma sessão autenticada.
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://xjivhwbrdjhipdfieqlg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqaXZod2JyZGpoaXBkZmllcWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjA4MzEsImV4cCI6MjA5MzkzNjgzMX0.v24Zopxx74_X-rNsKzGMDr0LU5OKdJsWD8036XaGp4s';

// Onde guardamos a sessão (token) no navegador
const SESSAO_KEY = 'kg_sessao';
// Marca que o usuário pediu "continuar conectado" (Lembrar de mim).
// Só uma sessão com essa marca sobrevive ao fechamento do app.
const LEMBRAR_FLAG = 'kg_lembrar_sessao';

const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  // ─── SESSÃO (token do usuário logado) ───
  _sessao: null,

  carregarSessao() {
    try {
      // 1º procura a sessão temporária (some quando o app é fechado).
      let bruto = sessionStorage.getItem(SESSAO_KEY);
      if (!bruto) {
        // 2º só usa a sessão permanente se o usuário marcou "Lembrar de mim".
        //    Sessões antigas (sem a marca) são descartadas → cai no login.
        if (localStorage.getItem(LEMBRAR_FLAG) === '1') {
          bruto = localStorage.getItem(SESSAO_KEY);
        } else {
          localStorage.removeItem(SESSAO_KEY);
        }
      }
      this._sessao = bruto ? JSON.parse(bruto) : null;
    } catch {
      this._sessao = null;
    }
    return this._sessao;
  },

  // Guarda (ou limpa) a sessão.
  //  lembrar === true  → permanente (localStorage): continua conectado ao reabrir.
  //  lembrar === false → temporária (sessionStorage): some ao fechar o app.
  //  lembrar === null  → renovação de token: mantém a sessão onde ela já estava.
  _guardarSessao(sessao, lembrar = null) {
    this._sessao = sessao;
    try {
      if (!sessao) {
        // Logout / sessão inválida → apaga tudo.
        localStorage.removeItem(SESSAO_KEY);
        sessionStorage.removeItem(SESSAO_KEY);
        localStorage.removeItem(LEMBRAR_FLAG);
        return;
      }
      const dados = JSON.stringify(sessao);
      if (lembrar === true) {
        localStorage.setItem(SESSAO_KEY, dados);
        localStorage.setItem(LEMBRAR_FLAG, '1');
        sessionStorage.removeItem(SESSAO_KEY);
      } else if (lembrar === false) {
        sessionStorage.setItem(SESSAO_KEY, dados);
        localStorage.removeItem(SESSAO_KEY);
        localStorage.removeItem(LEMBRAR_FLAG);
      } else {
        // Renovação: mantém no mesmo lugar onde a sessão vive hoje.
        if (localStorage.getItem(LEMBRAR_FLAG) === '1') {
          localStorage.setItem(SESSAO_KEY, dados);
        } else {
          sessionStorage.setItem(SESSAO_KEY, dados);
        }
      }
    } catch { /* ignora erro de storage */ }
  },

  _tokenAtual() {
    return this._sessao?.access_token || null;
  },

  estaLogado() {
    return !!this._tokenAtual();
  },

  // ─── REQUISIÇÃO REST (sempre com o token da sessão) ───
  async request(path, options = {}, _jaRenovou = false) {
    const token = this._tokenAtual();
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${token || this.key}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
        ...(options.headers || {})
      }
    });

    // Token expirado (401/403) → tenta renovar UMA vez e repetir a requisição
    if ((res.status === 401 || res.status === 403) && token && !_jaRenovou) {
      const renovou = await this._renovarSessao();
      if (renovou) {
        return this.request(path, options, true);
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro na requisição');
    }
    return res.status === 204 ? null : res.json();
  },

  // Renova a sessão usando o refresh_token (quando o token de acesso expira).
  // Retorna true se conseguiu renovar, false se a sessão acabou de vez.
  async _renovarSessao() {
    const refresh = this._sessao?.refresh_token;
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refresh })
      });
      if (!res.ok) {
        // Refresh inválido/expirado → limpa a sessão
        this._guardarSessao(null);
        return false;
      }
      const dados = await res.json();
      this._guardarSessao(dados);
      return true;
    } catch {
      return false;
    }
  },

  // ═══════════════════════════════════════════════
  //  AUTENTICAÇÃO (Supabase Auth)
  // ═══════════════════════════════════════════════

  async login(email, senha, lembrar = false) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password: senha })
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (dados.error_description || dados.msg || '').toLowerCase();
      if (msg.includes('invalid')) {
        throw new Error('Usuário ou senha incorretos.');
      }
      throw new Error(dados.error_description || dados.msg || 'Falha no login.');
    }
    this._guardarSessao(dados, lembrar);
    return dados;
  },

  async logout() {
    const token = this._tokenAtual();
    if (token) {
      try {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${token}`
          }
        });
      } catch { /* ignora */ }
    }
    this._guardarSessao(null);
  },

  // Busca o perfil (admin/consulta) do usuário logado
  async getPerfil() {
    const uid = this._sessao?.user?.id;
    if (!uid) return null;
    const data = await this.request(`perfis?id=eq.${uid}&select=tipo&limit=1`);
    return data[0]?.tipo || null;
  },

  emailLogado() {
    return this._sessao?.user?.email || null;
  },

  // ─── Monta a query de busca de produtos (compartilhada) ───
  _montarQueryProdutos(filtros = {}) {
    const limit  = filtros.limit  || 50;
    const offset = filtros.offset || 0;
    const dir    = filtros.direcao === 'desc' ? 'desc' : 'asc';
    const ordem  = filtros.ordenacao === 'codigo' ? `codigo.${dir}` : `nome.${dir}`;
    let query = `produtos?select=*&limit=${limit}&offset=${offset}&order=${ordem}`;

    if (filtros.categoria && filtros.categoria !== 'Todos') {
      query += `&categoria=eq.${encodeURIComponent(filtros.categoria)}`;
    }

    if (filtros.busca) {
      const termoLimpo = filtros.busca
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

      const palavras = termoLimpo.split(/\s+/).filter(p => p.length > 0);
      const esc = (s) => encodeURIComponent(s.replace(/[(),*\\]/g, ''));

      if (palavras.length === 1) {
        const p   = esc(palavras[0]);
        const cod = esc(termoLimpo);
        query += `&or=(nome_busca.ilike.%2A${p}%2A,codigo.ilike.%2A${cod}%2A)`;
      } else {
        palavras.forEach(p => {
          query += `&nome_busca=ilike.%2A${esc(p)}%2A`;
        });
      }
    }
    return query;
  },

  async getProdutos(filtros = {}) {
    return this.request(this._montarQueryProdutos(filtros));
  },

  async buscarPorCodigo(codigo) {
    const cod = encodeURIComponent(codigo);
    const data = await this.request(`produtos?codigo=eq.${cod}&select=id,nome,codigo&limit=1`);
    return data[0] || null;
  },

  async getProdutoPorId(id) {
    const data = await this.request(`produtos?id=eq.${id}&select=*`);
    return data[0] || null;
  },

  async criarProduto(produto) {
    return this.request('produtos', {
      method: 'POST',
      body: JSON.stringify(produto)
    });
  },

  async atualizarProduto(id, dados) {
    return this.request(`produtos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados)
    });
  },

  async deletarProduto(id) {
    return this.request(`produtos?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  },

  async getHistorico(produtoId) {
    return this.request(
      `historico_precos?produto_id=eq.${produtoId}&order=alterado_em.desc&limit=10&select=*`
    );
  },

  async salvarHistorico(dados) {
    return this.request('historico_precos', {
      method: 'POST',
      body: JSON.stringify(dados)
    });
  },

  async getContagemCategorias() {
    try {
      const data = await this.request('rpc/contar_categorias', {
        method: 'POST',
        body: JSON.stringify({}),
        prefer: 'return=representation'
      });
      const contagem = {};
      (data || []).forEach(row => {
        contagem[row.categoria] = row.total;
      });
      return contagem;
    } catch (e) {
      console.warn('RPC contar_categorias indisponível, usando fallback:', e.message);
      const data = await this.request('produtos?select=categoria');
      const contagem = {};
      (data || []).forEach(p => {
        contagem[p.categoria] = (contagem[p.categoria] || 0) + 1;
      });
      return contagem;
    }
  },

  // ─── Busca com AbortController (evita race conditions) ───
  _abortController: null,

  async getProdutosComAbort(filtros = {}, _jaRenovou = false) {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const query = this._montarQueryProdutos(filtros);
    const token = this._tokenAtual();

    const res = await fetch(`${this.url}/rest/v1/${query}`, {
      signal,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${token || this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    // Token expirado → renova uma vez e repete
    if ((res.status === 401 || res.status === 403) && token && !_jaRenovou) {
      const renovou = await this._renovarSessao();
      if (renovou) {
        return this.getProdutosComAbort(filtros, true);
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro na requisição');
    }
    return res.json();
  }
};

// Ao carregar o script, recupera a sessão salva (se houver)
supabase.carregarSessao();
