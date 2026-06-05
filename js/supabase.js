// ═══════════════════════════════════════════════
//  CONFIGURAÇÃO SUPABASE — KG AGROPET
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://xjivhwbrdjhipdfieqlg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqaXZod2JyZGpoaXBkZmllcWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjA4MzEsImV4cCI6MjA5MzkzNjgzMX0.v24Zopxx74_X-rNsKzGMDr0LU5OKdJsWD8036XaGp4s';

const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  async request(path, options = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro na requisição');
    }
    return res.status === 204 ? null : res.json();
  },

  // ─── Monta a query de busca de produtos (compartilhada) ───
  // Centraliza a lógica de filtros/ordenação/busca usada por
  // getProdutos e getProdutosComAbort (evita código duplicado).
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
      // Normalizar: remover acentos + minúsculas
      const termoLimpo = filtros.busca
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

      const palavras = termoLimpo.split(/\s+/).filter(p => p.length > 0);

      // Escapar caracteres especiais do PostgREST: ( ) , * \
      const esc = (s) => encodeURIComponent(s.replace(/[(),*\\]/g, ''));

      if (palavras.length === 1) {
        // Uma palavra: busca no nome_busca OU no código
        const p   = esc(palavras[0]);
        const cod = esc(termoLimpo);
        query += `&or=(nome_busca.ilike.%2A${p}%2A,codigo.ilike.%2A${cod}%2A)`;
      } else {
        // Várias palavras: TODAS devem aparecer no nome (AND)
        palavras.forEach(p => {
          query += `&nome_busca=ilike.%2A${esc(p)}%2A`;
        });
      }
    }
    return query;
  },

  // Buscar produtos com paginação
  async getProdutos(filtros = {}) {
    return this.request(this._montarQueryProdutos(filtros));
  },

  // Buscar produto por código exato (para validação de duplicidade)
  async buscarPorCodigo(codigo) {
    const cod = encodeURIComponent(codigo);
    const data = await this.request(`produtos?codigo=eq.${cod}&select=id,nome,codigo&limit=1`);
    return data[0] || null;
  },

  // Buscar produto por ID
  async getProdutoPorId(id) {
    const data = await this.request(`produtos?id=eq.${id}&select=*`);
    return data[0] || null;
  },

  // Criar produto
  async criarProduto(produto) {
    return this.request('produtos', {
      method: 'POST',
      body: JSON.stringify(produto)
    });
  },

  // Atualizar produto
  async atualizarProduto(id, dados) {
    return this.request(`produtos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados)
    });
  },

  // Deletar produto
  async deletarProduto(id) {
    return this.request(`produtos?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  },

  // Buscar usuário
  // OBS: usuário é case-insensitive (ilike) → aceita "Admin", "admin", "ADMIN".
  //      A senha continua exata (eq) por segurança.
  async getUsuario(usuario, senha) {
    const data = await this.request(
      `usuarios?usuario=ilike.${encodeURIComponent(usuario)}&senha=eq.${encodeURIComponent(senha)}&select=*`
    );
    return data[0] || null;
  },

  // Histórico de preços
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

  // Contagem por categoria via RPC (Stored Procedure no Supabase)
  // O banco processa o GROUP BY e devolve apenas 8 linhas em vez de todos os produtos
  async getContagemCategorias() {
    try {
      const data = await this.request('rpc/contar_categorias', {
        method: 'POST',
        body: JSON.stringify({}),
        prefer: 'return=representation'
      });
      // data = [{ categoria: 'Ração', total: 69 }, ...]
      const contagem = {};
      (data || []).forEach(row => {
        contagem[row.categoria] = row.total;
      });
      return contagem;
    } catch (e) {
      // Fallback: se a RPC não existir ainda, usa a query direta
      console.warn('RPC contar_categorias indisponível, usando fallback:', e.message);
      const data = await this.request('produtos?select=categoria');
      const contagem = {};
      (data || []).forEach(p => {
        contagem[p.categoria] = (contagem[p.categoria] || 0) + 1;
      });
      return contagem;
    }
  },

  // Cancela requisição de busca anterior para evitar race conditions
  _abortController: null,

  async getProdutosComAbort(filtros = {}) {
    // Cancela qualquer busca em andamento antes de iniciar a nova
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Usa a mesma lógica de montagem de query (sem duplicar código)
    const query = this._montarQueryProdutos(filtros);

    // Passa o signal do AbortController para o fetch
    const res = await fetch(`${this.url}/rest/v1/${query}`, {
      signal,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro na requisição');
    }
    return res.json();
  }
};
