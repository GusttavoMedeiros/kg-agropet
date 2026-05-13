// ═══════════════════════════════════════════════
//  KG AGROPET — APP PRINCIPAL
// ═══════════════════════════════════════════════

let estado = {
  usuario: null,
  tipo: 'admin',
  produtos: [],
  categoriaAtiva: 'Todos',
  produtoAtual: null,
  ordenacao: 'az', // 'az' ou 'codigo'
};

const CATEGORIAS = [
  'Ração', 'Veterinário', 'Sementes', 'Defensivos',
  'Pet', 'Higiene Animal', 'Acessórios', 'Outros'
];

const ICONES_CAT = {
  'Ração':          '🐾',
  'Veterinário':    '💉',
  'Sementes':       '🌱',
  'Defensivos':     '💧',
  'Pet':            '🐶',
  'Higiene Animal': '🧴',
  'Acessórios':     '🔧',
  'Outros':         '📦',
};

// ─── UTILIDADES ────────────────────────────────

function irPara(telaId) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById(telaId).classList.add('ativa');
}

function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visivel');
  setTimeout(() => t.classList.remove('visivel'), 2500);
}

function formatarMoeda(val) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(val || 0);
}

function formatarData(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR') + ' · ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function calcularMargem(compra, venda) {
  if (!compra || compra === 0) return 0;
  return (((venda - compra) / compra) * 100).toFixed(1);
}

// ─── ORDENAÇÃO ─────────────────────────────────

function ordenarProdutos(produtos) {
  if (estado.ordenacao === 'codigo') {
    return [...produtos].sort((a, b) => {
      const ca = (a.codigo || '').replace(/\D/g, '').padStart(10, '0');
      const cb = (b.codigo || '').replace(/\D/g, '').padStart(10, '0');
      return ca.localeCompare(cb);
    });
  }
  // az
  return [...produtos].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

function alternarOrdenacao(nova) {
  estado.ordenacao = nova;
  document.getElementById('btn-ord-az').classList.toggle('ativo', nova === 'az');
  document.getElementById('btn-ord-cod').classList.toggle('ativo', nova === 'codigo');
  renderizarProdutos(estado.produtos);
}

// ─── LOGIN ─────────────────────────────────────

function selecionarTipo(tipo) {
  estado.tipo = tipo;
  document.getElementById('btn-admin').classList.toggle('ativo', tipo === 'admin');
  document.getElementById('btn-consulta').classList.toggle('ativo', tipo === 'consulta');
}

async function fazerLogin() {
  const usuario = document.getElementById('inp-usuario').value.trim();
  const senha   = document.getElementById('inp-senha').value.trim();
  const erro    = document.getElementById('login-erro');

  if (!usuario || !senha) {
    erro.textContent = 'Preencha usuário e senha.';
    erro.style.display = 'block';
    return;
  }

  erro.style.display = 'none';
  const btn = document.querySelector('#tela-login .btn-primario');
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const user = await supabase.getUsuario(usuario, senha);
    if (!user) {
      erro.textContent = 'Usuário ou senha incorretos.';
      erro.style.display = 'block';
      return;
    }
    if (user.tipo !== estado.tipo) {
      erro.textContent = `Este usuário é do tipo "${user.tipo === 'admin' ? 'Administrador' : 'Consulta'}".`;
      erro.style.display = 'block';
      return;
    }
    estado.usuario = user;
    await carregarTelaBusca();
  } catch (e) {
    erro.textContent = 'Erro de conexão. Verifique sua internet.';
    erro.style.display = 'block';
    console.error(e);
  } finally {
    btn.textContent = 'ENTRAR';
    btn.disabled = false;
  }
}

function fazerLogout() {
  estado.usuario = null;
  estado.produtos = [];
  document.getElementById('inp-usuario').value = '';
  document.getElementById('inp-senha').value = '';
  irPara('tela-login');
}

// ─── TELA BUSCA ────────────────────────────────

async function carregarTelaBusca() {
  const badge = document.getElementById('badge-busca');
  badge.textContent = estado.tipo === 'admin' ? 'ADMIN' : 'CONSULTA';
  badge.className = 'badge ' + (estado.tipo === 'admin' ? 'badge-admin' : 'badge-consulta');

  document.getElementById('fab-add').style.display =
    estado.tipo === 'admin' ? 'flex' : 'none';

  montarCategorias();
  irPara('tela-busca');
  await carregarProdutos();
}

function montarCategorias() {
  const cont = document.getElementById('cats-lista');
  const cats = ['Todos', ...CATEGORIAS];
  cont.innerHTML = cats.map(c => `
    <button class="cat-pill ${c === estado.categoriaAtiva ? 'ativa' : ''}"
      onclick="selecionarCategoria('${c}')">${c}</button>
  `).join('');
}

function selecionarCategoria(cat) {
  estado.categoriaAtiva = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('ativa', p.textContent === cat);
  });
  carregarProdutos();
}

async function carregarProdutos() {
  const lista = document.getElementById('produto-lista');
  lista.innerHTML = '<div class="loading">Carregando...</div>';

  try {
    const busca = document.getElementById('inp-busca').value.trim();
    const filtros = { categoria: estado.categoriaAtiva, busca };
    estado.produtos = await supabase.getProdutos(filtros);
    renderizarProdutos(estado.produtos);
  } catch (e) {
    lista.innerHTML = '<div class="lista-vazia">⚠️ Erro ao carregar.<br>Verifique sua conexão.</div>';
    console.error(e);
  }
}

function renderizarProdutos(produtos) {
  const lista = document.getElementById('produto-lista');
  if (!produtos || produtos.length === 0) {
    lista.innerHTML = '<div class="lista-vazia">Nenhum produto encontrado.<br>Use o + para cadastrar.</div>';
    return;
  }
  const ordenados = ordenarProdutos(produtos);
  lista.innerHTML = ordenados.map(p => `
    <div class="produto-card" onclick="abrirDetalhe('${p.id}')" role="listitem">
      <div class="produto-icone">${ICONES_CAT[p.categoria] || '📦'}</div>
      <div class="produto-info">
        <div class="produto-nome">${p.nome}</div>
        <div class="produto-cat">${p.categoria} · ${p.codigo || '—'}</div>
      </div>
      <div class="produto-preco">
        <div class="preco-label">VENDA</div>
        <div class="preco-valor">${formatarMoeda(p.preco_venda)}</div>
      </div>
    </div>
  `).join('');
}

function filtrarProdutos() {
  clearTimeout(window._filtroTimer);
  window._filtroTimer = setTimeout(carregarProdutos, 350);
}

// ─── DETALHE ───────────────────────────────────

async function abrirDetalhe(id) {
  irPara('tela-detalhe');
  const corpo = document.getElementById('detalhe-corpo');
  corpo.innerHTML = '<div class="loading">Carregando...</div>';

  const badge = document.getElementById('badge-detalhe');
  badge.textContent = estado.tipo === 'admin' ? 'ADMIN' : 'CONSULTA';
  badge.className = 'badge ' + (estado.tipo === 'admin' ? 'badge-admin' : 'badge-consulta');

  try {
    const p = await supabase.getProdutoPorId(id);
    if (!p) { corpo.innerHTML = '<div class="lista-vazia">Produto não encontrado.</div>'; return; }
    estado.produtoAtual = p;

    const margem = calcularMargem(p.preco_compra, p.preco_venda);
    const lucro  = (p.preco_venda - p.preco_compra).toFixed(2);
    const isAdmin = estado.tipo === 'admin';

    corpo.innerHTML = `
      <div class="detalhe-hero">
        <div class="detalhe-icone">${ICONES_CAT[p.categoria] || '📦'}</div>
        <div class="detalhe-nome">${p.nome}</div>
        <div class="detalhe-cat">${p.categoria}</div>
        <div class="detalhe-codigo">Código: ${p.codigo || '—'}</div>
      </div>
      <div class="preco-grid">
        <div class="preco-box">
          <div class="preco-box-label">PREÇO DE COMPRA</div>
          <div class="preco-box-valor cor-compra">${formatarMoeda(p.preco_compra)}</div>
        </div>
        <div class="preco-box">
          <div class="preco-box-label">PREÇO DE VENDA</div>
          <div class="preco-box-valor cor-venda">${formatarMoeda(p.preco_venda)}</div>
        </div>
      </div>
      <div class="margem-box">
        Margem: <strong>${margem}%</strong> &nbsp;·&nbsp;
        Lucro: <strong>${formatarMoeda(lucro)}</strong> / unidade
      </div>
      <div class="meta-bloco">
        <div class="meta-linha">
          <span class="meta-chave">Categoria</span>
          <span class="meta-valor">${p.categoria}</span>
        </div>
        <div class="meta-linha">
          <span class="meta-chave">Última atualização</span>
          <span class="meta-valor">${formatarData(p.atualizado_em)}</span>
        </div>
        <div class="meta-linha" style="border:none">
          <span class="meta-chave">Atualizado por</span>
          <span class="meta-valor">${p.atualizado_por || '—'}</span>
        </div>
      </div>
      ${isAdmin ? `
        <button class="btn-editar" onclick="abrirEdicao('${p.id}')">
          ✏️ Editar preços
        </button>
      ` : ''}
    `;
  } catch (e) {
    corpo.innerHTML = '<div class="lista-vazia">Erro ao carregar produto.</div>';
    console.error(e);
  }
}

// ─── CADASTRO / EDIÇÃO ─────────────────────────

function preencherSelectCategoria(valorAtual = '') {
  const sel = document.getElementById('edit-categoria');
  sel.innerHTML = CATEGORIAS.map(c =>
    `<option value="${c}" ${c === valorAtual ? 'selected' : ''}>${c}</option>`
  ).join('');
}

function abrirCadastro() {
  document.getElementById('edit-id').value = '';
  document.getElementById('edit-nome').value = '';
  document.getElementById('edit-codigo').value = '';
  document.getElementById('edit-compra').value = '';
  document.getElementById('edit-venda').value = '';
  document.getElementById('edit-erro').style.display = 'none';
  document.getElementById('btn-deletar').style.display = 'none';
  document.getElementById('editar-titulo').textContent = 'Novo produto';
  document.getElementById('editar-voltar-btn').onclick = () => irPara('tela-busca');
  preencherSelectCategoria();
  irPara('tela-editar');
}

function abrirEdicao(id) {
  const p = estado.produtoAtual;
  if (!p) return;
  document.getElementById('edit-id').value = p.id;
  document.getElementById('edit-nome').value = p.nome;
  document.getElementById('edit-codigo').value = p.codigo || '';
  document.getElementById('edit-compra').value = p.preco_compra;
  document.getElementById('edit-venda').value = p.preco_venda;
  document.getElementById('edit-erro').style.display = 'none';
  document.getElementById('btn-deletar').style.display = 'block';
  document.getElementById('editar-titulo').textContent = 'Editar produto';
  document.getElementById('editar-voltar-btn').onclick = () => irPara('tela-detalhe');
  preencherSelectCategoria(p.categoria);
  irPara('tela-editar');
}

async function salvarProduto() {
  const id      = document.getElementById('edit-id').value;
  const nome    = document.getElementById('edit-nome').value.trim();
  const codigo  = document.getElementById('edit-codigo').value.trim();
  const cat     = document.getElementById('edit-categoria').value;
  const compra  = parseFloat(document.getElementById('edit-compra').value);
  const venda   = parseFloat(document.getElementById('edit-venda').value);
  const erro    = document.getElementById('edit-erro');

  if (!nome || isNaN(compra) || isNaN(venda)) {
    erro.textContent = 'Preencha nome, compra e venda.';
    erro.style.display = 'block';
    return;
  }
  if (venda < compra) {
    erro.textContent = 'Preço de venda menor que o de compra!';
    erro.style.display = 'block';
    return;
  }

  erro.style.display = 'none';
  const btn = document.querySelector('#tela-editar .btn-primario');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const dados = {
    nome, codigo, categoria: cat,
    preco_compra: compra, preco_venda: venda,
    atualizado_em: new Date().toISOString(),
    atualizado_por: estado.usuario?.usuario || 'Admin'
  };

  try {
    if (id) {
      await supabase.atualizarProduto(id, dados);
      mostrarToast('✅ Produto atualizado!');
      await abrirDetalhe(id);
    } else {
      await supabase.criarProduto(dados);
      mostrarToast('✅ Produto cadastrado!');
      await carregarTelaBusca();
    }
  } catch (e) {
    erro.textContent = 'Erro ao salvar. Tente novamente.';
    erro.style.display = 'block';
    console.error(e);
  } finally {
    btn.textContent = '💾 SALVAR';
    btn.disabled = false;
  }
}

async function deletarProduto() {
  const id = document.getElementById('edit-id').value;
  if (!id) return;
  if (!confirm('Deseja excluir este produto? Esta ação não pode ser desfeita.')) return;

  try {
    await supabase.deletarProduto(id);
    mostrarToast('🗑 Produto excluído.');
    await carregarTelaBusca();
  } catch (e) {
    alert('Erro ao excluir. Tente novamente.');
    console.error(e);
  }
}

// ─── INICIALIZAÇÃO ─────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  // Enter nos campos de login faz login
  document.getElementById('inp-usuario').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inp-senha').focus();
  });
  document.getElementById('inp-senha').addEventListener('keydown', e => {
    if (e.key === 'Enter') fazerLogin();
  });

  // Botões de ordenação — estado inicial
  document.getElementById('btn-ord-az').classList.add('ativo');
});

// ─── SERVICE WORKER ────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}
