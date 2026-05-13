// ═══════════════════════════════════════════════
//  KG AGROPET — APP PRINCIPAL
// ═══════════════════════════════════════════════

let estado = {
  usuario: null,
  tipo: 'admin',
  produtos: [],
  categoriaAtiva: 'Todos',
  produtoAtual: null,
  ordenacao: 'az',
  pagina: 0,
  carregandoMais: false,
  temMais: true,
  contagemCats: {},
};

const POR_PAGINA = 50;
const MAX_RECENTES = 5;

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

// ─── RECENTES (localStorage) ───────────────────

function salvarRecente(produto) {
  try {
    let recentes = JSON.parse(localStorage.getItem('kg_recentes') || '[]');
    recentes = recentes.filter(r => r.id !== produto.id);
    recentes.unshift({
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      codigo: produto.codigo,
      preco_venda: produto.preco_venda,
      visto_em: new Date().toISOString(),
    });
    recentes = recentes.slice(0, MAX_RECENTES);
    localStorage.setItem('kg_recentes', JSON.stringify(recentes));
  } catch(e) {}
}

function getRecentes() {
  try {
    return JSON.parse(localStorage.getItem('kg_recentes') || '[]');
  } catch(e) { return []; }
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
  return [...produtos].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

function alternarOrdenacao(nova) {
  estado.ordenacao = nova;
  document.getElementById('btn-ord-az').classList.toggle('ativo', nova === 'az');
  document.getElementById('btn-ord-cod').classList.toggle('ativo', nova === 'codigo');
  renderizarProdutos(estado.produtos, false);
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
    await carregarTelaInicio();
  } catch (e) {
    erro.textContent = 'Erro de conexão. Verifique sua internet.';
    erro.style.display = 'block';
    console.error(e);
  } finally {
    btn.textContent = 'ENTRAR';
    btn.disabled = false;
  }
}

function confirmarLogout() {
  const modal = document.getElementById('modal-logout');
  modal.style.display = 'flex';
}

function cancelarLogout() {
  document.getElementById('modal-logout').style.display = 'none';
}

function fazerLogout() {
  document.getElementById('modal-logout').style.display = 'none';
  estado.usuario = null;
  estado.produtos = [];
  document.getElementById('inp-usuario').value = '';
  document.getElementById('inp-senha').value = '';
  irPara('tela-login');
}

// ─── TELA INÍCIO RÁPIDO ────────────────────────

async function carregarTelaInicio() {
  // Badge
  const badge = document.getElementById('badge-inicio');
  badge.textContent = estado.tipo === 'admin' ? 'ADMIN' : 'CONSULTA';
  badge.className = 'badge ' + (estado.tipo === 'admin' ? 'badge-admin' : 'badge-consulta');

  // FAB
  document.getElementById('fab-inicio').style.display =
    estado.tipo === 'admin' ? 'flex' : 'none';

  irPara('tela-inicio');
  renderizarInicio();

  // Buscar contagem por categoria em paralelo
  supabase.getContagemCategorias().then(contagem => {
    estado.contagemCats = contagem;
    renderizarInicio();
  }).catch(() => {});
}

function renderizarInicio() {
  const recentes = getRecentes();
  const cont = document.getElementById('inicio-corpo');

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const blocoRecentes = recentes.length > 0 ? `
    <div class="inicio-secao">
      <div class="inicio-secao-titulo">🕐 Vistos recentemente</div>
      ${recentes.map(p => `
        <div class="produto-card" onclick="abrirDetalhe('${p.id}')">
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
      `).join('')}
    </div>
  ` : '';

  const totalGeral = Object.values(estado.contagemCats).reduce((a, b) => a + b, 0);

  const blocoCats = `
    <div class="inicio-secao">
      <div class="inicio-secao-titulo">📦 Produtos por categoria</div>
      <div class="cat-grid">
        <div class="cat-card cat-card-total" onclick="irParaBusca('Todos')">
          <div class="cat-card-icone">🏪</div>
          <div class="cat-card-nome">Todos</div>
          <div class="cat-card-num">${totalGeral || '—'}</div>
        </div>
        ${CATEGORIAS.map(c => `
          <div class="cat-card" onclick="irParaBusca('${c}')">
            <div class="cat-card-icone">${ICONES_CAT[c]}</div>
            <div class="cat-card-nome">${c}</div>
            <div class="cat-card-num">${estado.contagemCats[c] || 0}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  cont.innerHTML = `
    <div class="inicio-saudacao">
      ${saudacao()}, <strong>${estado.usuario?.usuario || 'usuário'}</strong>! 🌿
    </div>
    ${blocoRecentes}
    ${blocoCats}
  `;
}

function irParaBusca(categoria) {
  estado.categoriaAtiva = categoria;
  carregarTelaBusca();
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
  await resetarECarregar();
}

function montarCategorias() {
  const cont = document.getElementById('cats-lista');
  const cats = ['Todos', ...CATEGORIAS];
  cont.innerHTML = cats.map(c => {
    const num = c === 'Todos'
      ? Object.values(estado.contagemCats).reduce((a, b) => a + b, 0)
      : (estado.contagemCats[c] || 0);
    const label = num > 0 ? `${c} <span class="cat-num">(${num})</span>` : c;
    return `<button class="cat-pill ${c === estado.categoriaAtiva ? 'ativa' : ''}"
      onclick="selecionarCategoria('${c}')">${label}</button>`;
  }).join('');
}

function selecionarCategoria(cat) {
  estado.categoriaAtiva = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('ativa', p.textContent.startsWith(cat));
  });
  resetarECarregar();
}

async function resetarECarregar() {
  estado.pagina = 0;
  estado.produtos = [];
  estado.temMais = true;
  estado.carregandoMais = false;
  const lista = document.getElementById('produto-lista');
  lista.innerHTML = '<div class="loading">Carregando...</div>';
  await carregarMaisProdutos();
}

async function carregarMaisProdutos() {
  if (estado.carregandoMais || !estado.temMais) return;
  estado.carregandoMais = true;

  try {
    const busca = document.getElementById('inp-busca').value.trim();
    const filtros = {
      categoria: estado.categoriaAtiva,
      busca,
      offset: estado.pagina * POR_PAGINA,
      limit: POR_PAGINA,
    };
    const novos = await supabase.getProdutos(filtros);
    if (!novos || novos.length < POR_PAGINA) estado.temMais = false;
    estado.produtos = [...estado.produtos, ...novos];
    estado.pagina++;
    renderizarProdutos(estado.produtos, true);
  } catch (e) {
    if (estado.produtos.length === 0) {
      document.getElementById('produto-lista').innerHTML =
        '<div class="lista-vazia">⚠️ Erro ao carregar.<br>Verifique sua conexão.</div>';
    }
    console.error(e);
  } finally {
    estado.carregandoMais = false;
  }
}

function renderizarProdutos(produtos, manterScroll = false) {
  const lista = document.getElementById('produto-lista');
  const scrollAntes = lista.scrollTop;

  if (!produtos || produtos.length === 0) {
    lista.innerHTML = '<div class="lista-vazia">Nenhum produto encontrado.<br>Use o + para cadastrar.</div>';
    return;
  }

  const ordenados = ordenarProdutos(produtos);
  const rodape = estado.temMais
    ? `<div class="loading-mais" id="sentinel">Carregando mais...</div>`
    : `<div class="fim-lista">✓ ${produtos.length} produto${produtos.length !== 1 ? 's' : ''} carregado${produtos.length !== 1 ? 's' : ''}</div>`;

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
  `).join('') + rodape;

  if (manterScroll) lista.scrollTop = scrollAntes;

  const sentinel = document.getElementById('sentinel');
  if (sentinel) {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        carregarMaisProdutos();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
  }
}

function filtrarProdutos() {
  clearTimeout(window._filtroTimer);
  window._filtroTimer = setTimeout(resetarECarregar, 350);
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
    salvarRecente(p);

    const margem = calcularMargem(p.preco_compra, p.preco_venda);
    const lucro  = (p.preco_venda - p.preco_compra).toFixed(2);
    const isAdmin = estado.tipo === 'admin';

    // Histórico de preços
    const historico = await supabase.getHistorico(id);
    const blocoHistorico = historico && historico.length > 0 ? `
      <div class="hist-bloco">
        <div class="hist-titulo">📊 Histórico de preços</div>
        ${historico.map(h => `
          <div class="hist-linha">
            <span class="hist-data">${formatarData(h.alterado_em)}</span>
            <span class="hist-vals">
              <span class="cor-compra">C: ${formatarMoeda(h.preco_compra)}</span>
              <span class="cor-venda">V: ${formatarMoeda(h.preco_venda)}</span>
            </span>
            <span class="hist-por">${h.alterado_por || '—'}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

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
      ${blocoHistorico}
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
      // Salvar histórico antes de atualizar
      const anterior = estado.produtoAtual;
      if (anterior && (anterior.preco_compra !== compra || anterior.preco_venda !== venda)) {
        await supabase.salvarHistorico({
          produto_id: id,
          preco_compra: anterior.preco_compra,
          preco_venda: anterior.preco_venda,
          alterado_em: new Date().toISOString(),
          alterado_por: estado.usuario?.usuario || 'Admin'
        });
      }
      await supabase.atualizarProduto(id, dados);
      mostrarToast('✅ Produto atualizado!');
      await abrirDetalhe(id);
    } else {
      await supabase.criarProduto(dados);
      mostrarToast('✅ Produto cadastrado!');
      // Atualizar contagem
      supabase.getContagemCategorias().then(c => {
        estado.contagemCats = c;
      }).catch(() => {});
      await carregarTelaInicio();
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
    supabase.getContagemCategorias().then(c => { estado.contagemCats = c; }).catch(() => {});
    await carregarTelaInicio();
  } catch (e) {
    alert('Erro ao excluir. Tente novamente.');
    console.error(e);
  }
}

// ─── INICIALIZAÇÃO ─────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inp-usuario').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inp-senha').focus();
  });
  document.getElementById('inp-senha').addEventListener('keydown', e => {
    if (e.key === 'Enter') fazerLogin();
  });
  document.getElementById('btn-ord-az').classList.add('ativo');
});

// ─── SERVICE WORKER ────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}
