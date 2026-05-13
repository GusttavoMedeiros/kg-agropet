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

  // Buscar produtos com paginação
  async getProdutos(filtros = {}) {
    const limit  = filtros.limit  || 50;
    const offset = filtros.offset || 0;
    const ordem = filtros.ordenacao === 'codigo' ? 'codigo.asc' : 'nome.asc';
    let query = `produtos?select=*&limit=${limit}&offset=${offset}&order=${ordem}`;
    if (filtros.categoria && filtros.categoria !== 'Todos') {
      query += `&categoria=eq.${encodeURIComponent(filtros.categoria)}`;
    }
    if (filtros.busca) {
      query += `&or=(nome.ilike.*${encodeURIComponent(filtros.busca)}*,codigo.ilike.*${encodeURIComponent(filtros.busca)}*)`;
    }
    return this.request(query);
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
  async getUsuario(usuario, senha) {
    const data = await this.request(
      `usuarios?usuario=eq.${encodeURIComponent(usuario)}&senha=eq.${encodeURIComponent(senha)}&select=*`
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

  // Contagem por categoria
  async getContagemCategorias() {
    const data = await this.request('produtos?select=categoria');
    const contagem = {};
    (data || []).forEach(p => {
      contagem[p.categoria] = (contagem[p.categoria] || 0) + 1;
    });
    return contagem;
  }
};
