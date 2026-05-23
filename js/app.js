// ═══════════════════════════════════════════════
//  KG AGROPET — APP PRINCIPAL
// ═══════════════════════════════════════════════

let estado = {
  usuario: null,
  tipo: 'admin',
  produtos: [],
  categoriaAtiva: 'Todos',
  produtoAtual: null,
  ordenacao: 'az', // 'az', 'codigo' ou 'margem'
  direcao: 'asc',  // 'asc' ou 'desc'
  pagina: 0,
  carregandoMais: false,
  temMais: true,
  contagemCats: {},
  requisicaoBuscaId: 0,
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

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function textoSeguro(valor, fallback = '—') {
  const texto = String(valor ?? '').trim();
  return texto ? escaparHTML(texto) : fallback;
}

function argJS(valor) {
  return JSON.stringify(String(valor ?? ''))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function argAtributoJS(valor) {
  return escaparHTML(argJS(valor));
}

function exigirAdmin() {
  if (estado.tipo === 'admin') return true;
  mostrarToast('Apenas administradores podem alterar produtos.');
  return false;
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
  const dir = estado.direcao || 'asc';
  const inv = dir === 'desc' ? -1 : 1;

  if (estado.ordenacao === 'codigo') {
    return [...produtos].sort((a, b) => {
      const ca = (a.codigo || '').replace(/\D/g, '').padStart(10, '0');
      const cb = (b.codigo || '').replace(/\D/g, '').padStart(10, '0');
      return ca.localeCompare(cb) * inv;
    });
  }
  if (estado.ordenacao === 'margem') {
    return [...produtos].sort((a, b) => {
      const ma = a.preco_compra > 0 ? (a.preco_venda - a.preco_compra) / a.preco_compra : 0;
      const mb = b.preco_compra > 0 ? (b.preco_venda - b.preco_compra) / b.preco_compra : 0;
      // Default: maior para menor (desc). Se asc, inverte.
      return (mb - ma) * (dir === 'asc' ? -1 : 1);
    });
  }
  return [...produtos].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) * inv
  );
}

function alternarOrdenacao(nova) {
  // Se clicar no mesmo botão, inverte a direção
  if (estado.ordenacao === nova) {
    estado.direcao = estado.direcao === 'asc' ? 'desc' : 'asc';
  } else {
    estado.ordenacao = nova;
    // Margem padrão decrescente (maior margem primeiro); resto crescente
    estado.direcao = (nova === 'margem') ? 'desc' : 'asc';
  }

  // Atualizar visual dos botões
  ['az','codigo','margem'].forEach(tipo => {
    const el = document.getElementById('btn-ord-' + (tipo === 'codigo' ? 'cod' : tipo));
    if (el) el.classList.toggle('ativo', estado.ordenacao === tipo);
  });

  // Atualizar texto dos botões com seta de direção
  atualizarTextosOrdenacao();

  // Margem é ordenação local; az e codigo recarregam do servidor
  if (nova === 'margem') {
    renderizarProdutos(estado.produtos, false);
  } else {
    resetarECarregar();
  }
}

function atualizarTextosOrdenacao() {
  const dir = estado.direcao || 'asc';
  const seta = dir === 'asc' ? '↑' : '↓';
  const btnAz  = document.getElementById('btn-ord-az');
  const btnCod = document.getElementById('btn-ord-cod');
  const btnMg  = document.getElementById('btn-ord-margem');

  if (btnAz) {
    btnAz.innerHTML = estado.ordenacao === 'az'
      ? `<span class="ord-icon">🔤</span> ${dir === 'asc' ? 'A — Z' : 'Z — A'}`
      : `<span class="ord-icon">🔤</span> A — Z`;
  }
  if (btnCod) {
    btnCod.innerHTML = estado.ordenacao === 'codigo'
      ? `<span class="ord-icon">🔢</span> Cód. ${seta}`
      : `<span class="ord-icon">🔢</span> Cód. 001↑`;
  }
  if (btnMg) {
    btnMg.innerHTML = estado.ordenacao === 'margem'
      ? `<span class="ord-icon">📈</span> Margem ${seta}`
      : `<span class="ord-icon">📈</span> Margem`;
  }
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
    carregarCacheNomes(); // Cache para sugestões (em background)
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

  // Reset COMPLETO do estado do app
  estado.usuario = null;
  estado.produtos = [];
  estado.categoriaAtiva = 'Todos';
  estado.ordenacao = 'az';
  estado.direcao = 'asc';
  estado.pagina = 0;
  estado.produtoAtual = null;
  estado.contagemCats = {};

  // Limpar campos de login e busca
  document.getElementById('inp-usuario').value = '';
  document.getElementById('inp-senha').value = '';
  const inpBusca = document.getElementById('inp-busca');
  if (inpBusca) inpBusca.value = '';
  const btnX = document.getElementById('btn-limpar-busca');
  if (btnX) btnX.style.display = 'none';

  // Limpar sugestões e cache de nomes
  cacheNomes = null;
  const sug = document.getElementById('sugestoes-lista');
  if (sug) { sug.innerHTML = ''; sug.style.display = 'none'; }

  // Limpar histórico de produtos vistos recentemente
  try { localStorage.removeItem('kg_recentes'); } catch(e) {}

  // Resetar visual dos botões de ordenação
  atualizarTextosOrdenacao();
  ['az','codigo','margem'].forEach(t => {
    const el = document.getElementById('btn-ord-' + (t === 'codigo' ? 'cod' : t));
    if (el) el.classList.toggle('ativo', t === 'az');
  });

  // Voltar para login com perfil Admin selecionado por padrão
  selecionarTipo('admin');
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
        <div class="produto-card" onclick="abrirDetalhe(${argAtributoJS(p.id)})">
          <div class="produto-icone">${ICONES_CAT[p.categoria] || '📦'}</div>
          <div class="produto-info">
            <div class="produto-nome">${textoSeguro(p.nome)}</div>
            <div class="produto-cat">${textoSeguro(p.categoria)} · ${textoSeguro(p.codigo)}</div>
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
          <div class="cat-card" onclick="irParaBusca(${argAtributoJS(c)})">
            <div class="cat-card-icone">${ICONES_CAT[c]}</div>
            <div class="cat-card-nome">${escaparHTML(c)}</div>
            <div class="cat-card-num">${estado.contagemCats[c] || 0}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  cont.innerHTML = `
    <div class="inicio-saudacao">
      ${saudacao()}, <strong>${textoSeguro(estado.usuario?.usuario, 'usuário')}</strong>! 🌿
    </div>
    ${blocoRecentes}
    ${blocoCats}
  `;
}

function irParaBusca(categoria) {
  estado.categoriaAtiva = categoria;
  carregarTelaBusca();
}

// Volta para a lista de produtos forçando recarga (após editar produto)
async function voltarParaBusca() {
  // Limpa a lista em memória para forçar nova busca no servidor
  estado.produtos = [];
  estado.pagina = 0;
  estado.temMais = true;
  irPara('tela-busca');
  await resetarECarregar();
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
  // Destacar visualmente o campo de busca (pulse animation)
  const buscaBox = document.querySelector('.busca-box');
  if (buscaBox) {
    buscaBox.classList.add('busca-destaque');
    setTimeout(() => buscaBox.classList.remove('busca-destaque'), 1500);
  }
  await resetarECarregar();
}

function montarCategorias() {
  const cont = document.getElementById('cats-lista');
  const cats = ['Todos', ...CATEGORIAS];
  cont.innerHTML = cats.map(c => {
    const num = c === 'Todos'
      ? Object.values(estado.contagemCats).reduce((a, b) => a + b, 0)
      : (estado.contagemCats[c] || 0);
    const label = num > 0 ? `${escaparHTML(c)} <span class="cat-num">(${num})</span>` : escaparHTML(c);
    return `<button class="cat-pill ${c === estado.categoriaAtiva ? 'ativa' : ''}"
      data-cat="${escaparHTML(c)}"
      onclick="selecionarCategoria(${argAtributoJS(c)})">${label}</button>`;
  }).join('');
}

function selecionarCategoria(cat) {
  estado.categoriaAtiva = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('ativa', p.dataset.cat === cat);
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
  const requisicaoAtual = ++estado.requisicaoBuscaId;

  try {
    const busca = document.getElementById('inp-busca').value.trim();
    const filtros = {
      categoria: estado.categoriaAtiva,
      busca,
      offset: estado.pagina * POR_PAGINA,
      limit: POR_PAGINA,
      ordenacao: estado.ordenacao,
      direcao: estado.direcao,
    };
    // getProdutosComAbort cancela requisições antigas automaticamente (AbortController)
    const novos = await supabase.getProdutosComAbort(filtros);
    if (requisicaoAtual !== estado.requisicaoBuscaId) return;
    if (!novos || novos.length < POR_PAGINA) estado.temMais = false;
    estado.produtos = [...estado.produtos, ...novos];
    estado.pagina++;
    renderizarProdutos(estado.produtos, true);
  } catch (e) {
    // AbortError é intencional (nova busca cancelou a anterior) — ignora silenciosamente
    if (e.name === 'AbortError') return;
    if (requisicaoAtual !== estado.requisicaoBuscaId) return;
    if (estado.produtos.length === 0) {
      document.getElementById('produto-lista').innerHTML =
        '<div class="lista-vazia">⚠️ Erro ao carregar.<br>Verifique sua conexão.</div>';
    }
    console.error(e);
  } finally {
    if (requisicaoAtual === estado.requisicaoBuscaId) {
      estado.carregandoMais = false;
    }
  }
}


// ─── INDICADOR DE MARGEM ───────────────────────

function indicadorMargem(compra, venda) {
  if (!compra || compra === 0) return { cor: 'margem-nd', label: '—' };
  const pct = ((venda - compra) / compra) * 100;
  if (pct >= 40)  return { cor: 'margem-alta',  label: `${pct.toFixed(0)}%` };
  if (pct >= 20)  return { cor: 'margem-media', label: `${pct.toFixed(0)}%` };
  if (pct >= 0)   return { cor: 'margem-baixa', label: `${pct.toFixed(0)}%` };
  return { cor: 'margem-negativa', label: `${pct.toFixed(0)}%` };
}

function renderizarProdutos(produtos, manterScroll = false) {
  const lista = document.getElementById('produto-lista');
  const scrollAntes = lista.scrollTop;

  // Desconectar observer anterior antes de renderizar nova lista.
  if (window._sentinelObserver) {
    window._sentinelObserver.disconnect();
    window._sentinelObserver = null;
  }

  if (!produtos || produtos.length === 0) {
    lista.innerHTML = '<div class="lista-vazia">Nenhum produto encontrado.<br>Use o + para cadastrar.</div>';
    return;
  }

  const ordenados = ordenarProdutos(produtos);
  const rodape = estado.temMais
    ? `<div class="loading-mais" id="sentinel">Carregando mais...</div>`
    : `<div class="fim-lista">✓ ${produtos.length} produto${produtos.length !== 1 ? 's' : ''} carregado${produtos.length !== 1 ? 's' : ''}</div>`;

  lista.innerHTML = ordenados.map(p => {
    const mg = indicadorMargem(p.preco_compra, p.preco_venda);
    return `
    <div class="produto-card" onclick="abrirDetalhe(${argAtributoJS(p.id)})" role="listitem">
      <div class="produto-icone">${ICONES_CAT[p.categoria] || '📦'}</div>
      <div class="produto-info">
        <div class="produto-nome">${textoSeguro(p.nome)}</div>
        <div class="produto-cat">${textoSeguro(p.categoria)} · ${textoSeguro(p.codigo)}</div>
      </div>
      <div class="produto-preco">
        <div class="preco-label">VENDA</div>
        <div class="preco-valor">${formatarMoeda(p.preco_venda)}</div>
        <div class="margem-pill ${mg.cor}">${mg.label}</div>
      </div>
    </div>
  `}).join('') + rodape;

  if (manterScroll) lista.scrollTop = scrollAntes;

  const sentinel = document.getElementById('sentinel');
  if (sentinel) {
    window._sentinelObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        window._sentinelObserver.disconnect();
        window._sentinelObserver = null;
        carregarMaisProdutos();
      }
    }, { threshold: 0.1 });
    window._sentinelObserver.observe(sentinel);
  }
}


// ─── BUSCA INTELIGENTE (sugestões + fuzzy) ─────

function normalizar(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Distância de Levenshtein simplificada
function distancia(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i-1] === b[j-1]
        ? dp[j-1]
        : 1 + Math.min(dp[j-1], dp[j], prev);
      prev = temp;
    }
    dp[0] = i;
  }
  return dp[b.length];
}

// Cache local dos nomes de produtos para sugestões rápidas
let cacheNomes = null;

async function carregarCacheNomes() {
  try {
    const todos = await supabase.getProdutos({ limit: 1000 });
    cacheNomes = (todos || []).map(p => ({
      id: p.id,
      nome: p.nome,
      nome_norm: normalizar(p.nome),
      codigo: p.codigo || ''
    }));
  } catch(e) { cacheNomes = []; }
}

function gerarSugestoes(termo) {
  if (!cacheNomes || cacheNomes.length === 0) return [];
  const tNorm = normalizar(termo);
  if (tNorm.length < 2) return [];

  const palavras = tNorm.split(/\s+/).filter(Boolean);

  // 1. Matches exatos (contém o termo)
  const exatos = cacheNomes.filter(p =>
    palavras.every(pal => p.nome_norm.includes(pal)) ||
    p.codigo.toLowerCase().includes(tNorm)
  );

  // 2. Se há matches exatos suficientes, retorna eles
  if (exatos.length >= 5) return exatos.slice(0, 5);

  // 3. Senão, complementa com matches por similaridade (fuzzy)
  const fuzzy = cacheNomes
    .filter(p => !exatos.some(e => e.id === p.id))
    .map(p => {
      // Para cada palavra do nome, pega a menor distância contra o termo
      const palavrasNome = p.nome_norm.split(/\s+/);
      let melhorDist = Infinity;
      for (const palNome of palavrasNome) {
        for (const palTermo of palavras) {
          if (palTermo.length < 3) continue;
          const d = distancia(palTermo, palNome.slice(0, palTermo.length + 1));
          if (d < melhorDist) melhorDist = d;
        }
      }
      return { ...p, dist: melhorDist };
    })
    .filter(p => p.dist <= 2)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5 - exatos.length);

  return [...exatos, ...fuzzy].slice(0, 5);
}

function mostrarSugestoes() {
  const termo = document.getElementById('inp-busca').value;
  const cont = document.getElementById('sugestoes-lista');

  if (!termo || termo.length < 2) {
    cont.innerHTML = '';
    cont.style.display = 'none';
    return;
  }

  const sugs = gerarSugestoes(termo);
  if (sugs.length === 0) {
    cont.innerHTML = '';
    cont.style.display = 'none';
    return;
  }

  cont.innerHTML = sugs.map(s => `
    <div class="sugestao-item" onclick="aplicarSugestao(${argAtributoJS(s.id)}, ${argAtributoJS(s.nome)})">
      <span class="sugestao-icone">🔍</span>
      <span class="sugestao-texto">${textoSeguro(s.nome)}</span>
      <span class="sugestao-codigo">${textoSeguro(s.codigo, '')}</span>
    </div>
  `).join('');
  cont.style.display = 'block';
}

function aplicarSugestao(id, nome) {
  document.getElementById('inp-busca').value = nome;
  document.getElementById('sugestoes-lista').style.display = 'none';
  abrirDetalhe(id);
}

function esconderSugestoes() {
  setTimeout(() => {
    const cont = document.getElementById('sugestoes-lista');
    if (cont) cont.style.display = 'none';
  }, 200);
}

function filtrarProdutos() {
  // Mostrar/esconder botão X de acordo com o conteúdo
  const inp = document.getElementById('inp-busca');
  const btn = document.getElementById('btn-limpar-busca');
  if (btn) btn.style.display = inp.value.length > 0 ? 'flex' : 'none';

  mostrarSugestoes();
  clearTimeout(window._filtroTimer);
  window._filtroTimer = setTimeout(resetarECarregar, 400);
}

function limparBusca() {
  const inp = document.getElementById('inp-busca');
  inp.value = '';
  document.getElementById('btn-limpar-busca').style.display = 'none';
  const sug = document.getElementById('sugestoes-lista');
  if (sug) sug.style.display = 'none';
  resetarECarregar();
  inp.focus();
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
            <span class="hist-por">${textoSeguro(h.alterado_por)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    corpo.innerHTML = `
      <div class="detalhe-hero">
        <div class="detalhe-icone">${ICONES_CAT[p.categoria] || '📦'}</div>
        <div class="detalhe-nome">${textoSeguro(p.nome, 'Produto sem nome')}</div>
        <div class="detalhe-cat">${textoSeguro(p.categoria)}</div>
        <div class="detalhe-codigo">Código: ${textoSeguro(p.codigo)}</div>
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
          <span class="meta-valor">${textoSeguro(p.categoria)}</span>
        </div>
        <div class="meta-linha">
          <span class="meta-chave">Última atualização</span>
          <span class="meta-valor">${formatarData(p.atualizado_em)}</span>
        </div>
        <div class="meta-linha" style="border:none">
          <span class="meta-chave">Atualizado por</span>
          <span class="meta-valor">${textoSeguro(p.atualizado_por)}</span>
        </div>
      </div>
      ${blocoHistorico}
      ${isAdmin ? `
        <button class="btn-editar" onclick="abrirEdicao(${argAtributoJS(p.id)})">
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
    `<option value="${escaparHTML(c)}" ${c === valorAtual ? 'selected' : ''}>${escaparHTML(c)}</option>`
  ).join('');
}

function abrirCadastro() {
  if (!exigirAdmin()) return;
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
  if (!exigirAdmin()) return;
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
  if (!exigirAdmin()) return;
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

  // VALIDAÇÃO DE CÓDIGO DUPLICADO
  if (codigo) {
    erro.style.display = 'none';
    const btnCheck = document.querySelector('#tela-editar .btn-primario');
    btnCheck.textContent = 'Verificando código...';
    btnCheck.disabled = true;
    try {
      const existente = await supabase.buscarPorCodigo(codigo);
      // Se encontrou e não é o próprio produto sendo editado
      if (existente && existente.id !== id) {
        erro.textContent = `⚠️ O código "${codigo}" já está em uso pelo produto "${existente.nome}".`;
        erro.style.display = 'block';
        btnCheck.textContent = '💾 SALVAR';
        btnCheck.disabled = false;
        return;
      }
    } catch (e) {
      console.error('Erro ao verificar código:', e);
    }
  }

  erro.style.display = 'none';
  const btn = document.querySelector('#tela-editar .btn-primario');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  // Normaliza o nome para busca (sem acento, minúsculas)
  const nomeBusca = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const dados = {
    nome,
    nome_busca: nomeBusca,
    codigo, categoria: cat,
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

      // Atualizações em paralelo (em background)
      await Promise.all([
        carregarCacheNomes(),
        supabase.getContagemCategorias().then(c => { estado.contagemCats = c; }).catch(() => {})
      ]);

      // Invalidar lista para recarregar do servidor na próxima visualização
      estado.produtos = [];
      estado.pagina = 0;
      estado.temMais = true;

      await abrirDetalhe(id);
    } else {
      await supabase.criarProduto(dados);
      mostrarToast('✅ Produto cadastrado!');

      // Atualizações em paralelo
      await Promise.all([
        carregarCacheNomes(),
        supabase.getContagemCategorias().then(c => { estado.contagemCats = c; }).catch(() => {})
      ]);

      // Resetar lista
      estado.produtos = [];
      estado.pagina = 0;
      estado.temMais = true;

      await carregarTelaInicio();
    }
  } catch (e) {
    erro.textContent = 'Erro ao salvar: ' + (e.message || 'tente novamente');
    erro.style.display = 'block';
    console.error('Erro detalhado:', e);
  } finally {
    btn.textContent = '💾 SALVAR';
    btn.disabled = false;
  }
}

async function deletarProduto() {
  if (!exigirAdmin()) return;
  const id = document.getElementById('edit-id').value;
  if (!id) return;
  if (!confirm('Deseja excluir este produto? Esta ação não pode ser desfeita.')) return;

  try {
    await supabase.deletarProduto(id);
    mostrarToast('🗑 Produto excluído.');

    // Atualizações em paralelo
    await Promise.all([
      carregarCacheNomes(),
      supabase.getContagemCategorias().then(c => { estado.contagemCats = c; }).catch(() => {})
    ]);

    // Resetar lista
    estado.produtos = [];
    estado.pagina = 0;
    estado.temMais = true;
    estado.produtoAtual = null;

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
