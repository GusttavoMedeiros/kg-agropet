// ═══════════════════════════════════════════════
//  CONFIGURAÇÃO SUPABASE
//  ⚠️ Substitua os valores abaixo após criar sua conta
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://xjivhwbrdjhipdfieqlg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqaXZod2JyZGpoaXBkZmllcWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjA4MzEsImV4cCI6MjA5MzkzNjgzMX0.v24Zopxx74_X-rNsKzGMDr0LU5OKdJsWD8036XaGp4s';

// Cliente Supabase simplificado (sem biblioteca externa)
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

  // Buscar todos os produtos
  async getProdutos(filtros = {}) {
    let query = 'produtos?select=*&order=nome.asc';
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
      prefer: 'return=minimal',
      headers: { 'Prefer': 'return=minimal' }
    });
  },

  // Buscar usuários
  async getUsuario(usuario, senha) {
    const data = await this.request(
      `usuarios?usuario=eq.${encodeURIComponent(usuario)}&senha=eq.${encodeURIComponent(senha)}&select=*`
    );
    return data[0] || null;
  }
};
