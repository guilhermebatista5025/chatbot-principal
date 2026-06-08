// Modo de Funcionamento do Painel
// SE true: Roda em modo puramente visual com dados de demonstração (não requer banco ativo).
// SE false: Consome os dados reais do backend e do banco Supabase em tempo real.
const VISUAL_MODE_ONLY = false;

// Configuração da URL da API do backend
const API_URL = "";

// Elementos do DOM
const sectorsGrid = document.getElementById("sectors-grid");
const totalJobsCountEl = document.getElementById("total-jobs-count");
const tabs = document.querySelectorAll(".menu-item");
const clockEl = document.getElementById("live-clock");
const dateEl = document.getElementById("live-date");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const pageTitleEl = document.getElementById("page-title");
const pageSubtitleEl = document.getElementById("page-subtitle");

// Elementos do Modal de Observações
const obsModal = document.getElementById("obs-modal");
const modalObsText = document.getElementById("modal-obs-text");
const modalObsClientName = document.getElementById("modal-obs-client-name");
const btnCloseObsModal = document.getElementById("btn-close-obs-modal");

// Metadados dos Setores para Atualização do Título do Header
const sectorMeta = {
  "Todos": { title: "Todos os Setores", subtitle: "Monitore os agendamentos ativos divididos por setores de serviços." },
  "Limpeza": { title: "Limpeza & Lavagem", subtitle: "Serviços ativos de lavagem detalhada e higienização interna." },
  "Estetica": { title: "Polimento & Estética", subtitle: "Serviços ativos de polimento, vitrificação e embelezamento." },
  "Mecanica": { title: "Parte Mecânica", subtitle: "Serviços de revisão de motor, suspensão, freios e óleos." },
  "PPF": { title: "PPF & Películas", subtitle: "Serviços de aplicação de PPF, películas e envelopamento." }
};

// Dados Simulados para o Modo Visual
const MOCK_APPOINTMENTS = [
  {
    id: "mock-1",
    from: "5511999999999",
    pushname: "Carlos Augusto",
    servico: "Lavagem Técnica Detalhada",
    veiculo: "Corolla [ABC-1234]",
    placa: "ABC-1234",
    agendamentoDia: "Segunda-feira (08/06)",
    agendamentoTurno: "Manhã",
    observacoes: "Higienizar carpete sobressalente no porta-malas.",
    status: "Pendente"
  },
  {
    id: "mock-2",
    from: "5511888888888",
    pushname: "Marina Silva",
    servico: "Higienização e Detalhamento Interno",
    veiculo: "Jeep Compass [XYZ-9876]",
    placa: "XYZ-9876",
    agendamentoDia: "Segunda-feira (08/06)",
    agendamentoTurno: "Tarde",
    observacoes: "Manchas de café no banco traseiro do veículo.",
    status: "Pendente"
  },
  {
    id: "mock-3",
    from: "5511777777777",
    pushname: "Ricardo Ramos",
    servico: "Polimento Técnico & Lustro",
    veiculo: "Civic [KPT-4512]",
    placa: "KPT-4512",
    agendamentoDia: "Terça-feira (09/06)",
    agendamentoTurno: "Manhã",
    observacoes: "Leve risco na porta do motorista para remover com lixamento suave.",
    status: "Pendente"
  },
  {
    id: "mock-4",
    from: "5511666666666",
    pushname: "Felipe Mendes",
    servico: "Vitrificação de Pintura 9H",
    veiculo: "Porsche Macan [PPP-5555]",
    placa: "PPP-5555",
    agendamentoDia: "Terça-feira (09/06)",
    agendamentoTurno: "Tarde",
    observacoes: "Carro zero km, retirar plásticos de proteção dos bancos e soleiras.",
    status: "Pendente"
  },
  {
    id: "mock-5",
    from: "5511555555555",
    pushname: "Amanda Costa",
    servico: "Revisão e Mecânica Geral",
    veiculo: "Onix [AAA-1111]",
    placa: "AAA-1111",
    agendamentoDia: "Segunda-feira (08/06)",
    agendamentoTurno: "Manhã",
    observacoes: "Barulho estranho na suspensão dianteira direita ao passar por lombadas.",
    status: "Pendente"
  },
  {
    id: "mock-6",
    from: "5511444444444",
    pushname: "Thiago Oliveira",
    servico: "Aplicação de PPF Completo",
    veiculo: "BMW M3 [BMW-3333]",
    placa: "BMW-3333",
    agendamentoDia: "Quarta-feira (10/06)",
    agendamentoTurno: "Tarde",
    observacoes: "PPF frontal, soleiras de porta e retrovisores externos em black piano.",
    status: "Pendente"
  }
];

// Cache local de agendamentos
let activeAppointments = [];
let selectedSector = "Todos";

// Mapeamento de Cores para Serviços
function getServiceColor(servico) {
  if (!servico) return "#2563EB";
  const name = servico.toLowerCase();
  
  if (name.includes("lavagem")) {
    return "#3B82F6"; // Azul brilhante
  } else if (name.includes("higienização") || name.includes("higienizacao") || name.includes("detalhamento interno")) {
    return "#10B981"; // Verde esmeralda
  } else if (name.includes("polimento") || name.includes("lustro")) {
    return "#F59E0B"; // Laranja / Âmbar
  } else if (name.includes("vitrificação") || name.includes("vitrificacao")) {
    return "#8B5CF6"; // Roxo violeta
  } else if (name.includes("verniz") || name.includes("motor")) {
    return "#06B6D4"; // Ciano
  } else if (name.includes("farol") || name.includes("faróis") || name.includes("farois")) {
    return "#EAB308"; // Amarelo ouro
  } else if (name.includes("mecanica") || name.includes("mecânica")) {
    return "#EF4444"; // Vermelho
  }
  
  // Hash consistente para serviços dinâmicos cadastrados pelo usuário
  const hash = servico.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#EAB308", "#EF4444", "#EC4899", "#14B8A6"];
  return colors[hash % colors.length];
}

function getServiceColorGlow(color) {
  return color + "26"; // 15% opacity
}

// Classifica o agendamento em um setor com base no nome do serviço
function getSectorFromService(servico) {
  if (!servico) return "Limpeza"; // Padrão
  const name = servico.toLowerCase();
  
  // Mecânica
  if (name.includes("mecanica") || name.includes("mecânica") || name.includes("motor") || name.includes("freio") || name.includes("óleo") || name.includes("suspensão")) {
    return "Mecanica";
  }
  // PPF & Películas / Proteção
  if (name.includes("ppf") || name.includes("película") || name.includes("adesivo") || name.includes("envelopamento") || name.includes("proteção") || name.includes("protecao")) {
    return "PPF";
  }
  // Polimento & Estética
  if (name.includes("polimento") || name.includes("vitrificaç") || name.includes("vitrificac") || name.includes("farol") || name.includes("farói") || name.includes("verniz") || name.includes("estética") || name.includes("estetica") || name.includes("cristalizaç")) {
    return "Estetica";
  }
  // Limpeza
  if (name.includes("lavagem") || name.includes("higienizac") || name.includes("higienizaç") || name.includes("limpeza") || name.includes("interno") || name.includes("aspirad")) {
    return "Limpeza";
  }
  
  return "Limpeza"; // Fallback para Limpeza
}

// Formatar números de telefone
function formatPhoneNumber(num) {
  if (!num) return "";
  const clean = num.replace(/\D/g, "");
  
  if (clean.startsWith("55") && clean.length >= 11) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 6)}-${rest.slice(6)}`;
    } else {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
  }
  
  if (clean.length >= 10) {
    const ddd = clean.slice(0, 2);
    const rest = clean.slice(2);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 6)}-${rest.slice(6)}`;
    } else {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
  }

  return num;
}

// Relógio em Tempo Real
function initClock() {
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("pt-BR");
    
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    dateEl.textContent = now.toLocaleDateString("pt-BR", options);
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Exibir Toast
function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

// Buscar agendamentos na API ou usar Mocks
async function fetchAppointments() {
  if (VISUAL_MODE_ONLY) {
    // No modo visual, mantemos as ações puramente locais para não sobrescrever o progresso do usuário
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/appointments`);
    const data = await res.json();
    
    // Filtrar apenas agendamentos ATIVOS (status diferente de "Finalizado")
    activeAppointments = data.filter(app => app.status !== "Finalizado");
    
    updateTabCounts();
    renderGrid();
  } catch (error) {
    console.error("Erro ao carregar agendamentos do backend:", error);
  }
}

// Atualizar contadores das abas
function updateTabCounts() {
  const counts = {
    Todos: activeAppointments.length,
    Limpeza: 0,
    Estetica: 0,
    Mecanica: 0,
    PPF: 0
  };
  
  activeAppointments.forEach(app => {
    const sector = getSectorFromService(app.servico);
    if (counts[sector] !== undefined) {
      counts[sector]++;
    }
  });
  
  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = counts[key];
  });
  
  if (totalJobsCountEl) {
    totalJobsCountEl.textContent = activeAppointments.length;
  }
}

// Renderizar o Grid de Cards
function renderGrid() {
  if (!sectorsGrid) return;
  
  // Filtrar pela aba selecionada
  const filtered = selectedSector === "Todos" 
    ? activeAppointments 
    : activeAppointments.filter(app => getSectorFromService(app.servico) === selectedSector);
    
  if (filtered.length === 0) {
    sectorsGrid.innerHTML = `
      <div class="sectors-empty-state">
        <div class="empty-icon">✓</div>
        <h3>Tudo limpo!</h3>
        <p>Nenhum serviço pendente nesta categoria no momento.</p>
      </div>
    `;
    return;
  }
  
  sectorsGrid.innerHTML = "";
  
  filtered.forEach(app => {
    const card = document.createElement("div");
    card.className = "sector-card";
    
    const color = getServiceColor(app.servico);
    card.style.setProperty("--service-color", color);
    card.style.setProperty("--service-color-glow", getServiceColorGlow(color));
    
    const formattedPhone = formatPhoneNumber(app.from);
    const displayName = app.pushname && app.pushname !== "Cliente" ? app.pushname : "Cliente";
    
    const turno = app.agendamentoTurno || "Geral";
    const isManha = turno.toLowerCase().includes("manhã") || turno.toLowerCase().includes("manha");
    const timeClass = isManha ? "manha" : "tarde";
    const timeText = isManha ? "Manhã" : "Tarde";
    
    // Extrai placa se estiver no formato Placa [ABC-1234] ou similar
    let plateClean = app.placa || "N/A";
    if (plateClean === "N/A" && app.veiculo && app.veiculo.includes("[")) {
      const parts = app.veiculo.split("[");
      if (parts.length > 1) {
        plateClean = parts[1].replace("]", "").trim();
      }
    }
    
    card.innerHTML = `
      <div class="card-header-row">
        <div class="client-info">
          <span class="client-name">${displayName}</span>
          <span class="client-phone">${formattedPhone}</span>
        </div>
        <span class="time-badge ${timeClass}">${timeText}</span>
      </div>
      
      <div class="card-body-details">
        <div class="detail-row">
          <span class="detail-label">💎 Serviço:</span>
          <span class="detail-value service-highlight">${app.servico}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">🚗 Carro:</span>
          <span class="detail-value">${app.veiculo ? app.veiculo.split("[")[0].trim() : "N/A"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">🎫 Placa:</span>
          <span class="detail-value"><span class="simple-plate-text">${plateClean}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">🗓️ Agendado para:</span>
          <span class="detail-value" style="color: var(--primary); font-weight: 700;">${app.agendamentoDia || "N/A"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📋 Obs:</span>
          <span class="detail-value">
            ${app.observacoes && app.observacoes !== "N/A" && app.observacoes !== "Nenhuma" ? `
              <button class="btn-obs-icon" data-obs="${encodeURIComponent(app.observacoes)}" data-client="${encodeURIComponent(displayName)}" title="Ver Observações">
                💬 Ver Nota
              </button>
            ` : `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nenhuma</span>`}
          </span>
        </div>
      </div>
      
      <button class="card-action-btn" data-id="${app.id || ''}">
        <span class="btn-check-icon">✓</span>
        <span>Finalizar Serviço</span>
      </button>
    `;
    
    // Configurar o clique no botão Finalizar
    const btn = card.querySelector(".card-action-btn");
    btn.addEventListener("click", async () => {
      let appointmentId = app.id;
      
      if (!appointmentId) {
        showToast("Erro: ID do agendamento não disponível.");
        return;
      }
      
      // Animação de fade-out do card
      card.classList.add("fade-out");
      
      // Chamar API ou Simular Localmente após animação
      setTimeout(async () => {
        if (VISUAL_MODE_ONLY) {
          // Apenas deleta localmente no array em memória
          activeAppointments = activeAppointments.filter(item => item.id !== appointmentId);
          showToast(`Serviço de ${displayName} finalizado com sucesso!`);
          updateTabCounts();
          renderGrid();
        } else {
          try {
            const res = await fetch(`${API_URL}/api/appointments/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: appointmentId, status: "Finalizado" })
            });
            const result = await res.json();
            if (result.success) {
              showToast(`Serviço de ${displayName} finalizado com sucesso!`);
              fetchAppointments();
            } else {
              showToast("Erro ao finalizar o serviço.");
              card.classList.remove("fade-out"); // reverte
            }
          } catch (err) {
            showToast("Erro na conexão com o servidor.");
            card.classList.remove("fade-out"); // reverte
          }
        }
      }, 400);
    });
    
    sectorsGrid.appendChild(card);
  });

  // Eventos de clique para os botões de observações (Modal)
  document.querySelectorAll(".btn-obs-icon").forEach(btn => {
    btn.addEventListener("click", () => {
      const obsText = decodeURIComponent(btn.getAttribute("data-obs"));
      const clientName = decodeURIComponent(btn.getAttribute("data-client"));
      
      modalObsClientName.textContent = `Observações: ${clientName}`;
      modalObsText.textContent = obsText;
      
      obsModal.classList.remove("hidden");
    });
  });
}

// Configurar Abas de Setores
function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      selectedSector = tab.getAttribute("data-sector");
      
      // Atualizar títulos no cabeçalho
      if (sectorMeta[selectedSector]) {
        pageTitleEl.textContent = sectorMeta[selectedSector].title;
        pageSubtitleEl.textContent = sectorMeta[selectedSector].subtitle;
      }
      
      renderGrid();
    });
  });
}

// Gerenciador de Alternação de Layout (Grade / Lista Deitada)
function initLayoutManager() {
  const btnGrid = document.getElementById("btn-grid-view");
  const btnList = document.getElementById("btn-list-view");
  
  if (!btnGrid || !btnList || !sectorsGrid) return;
  
  // Por padrão, agora iniciamos no formato "list" (deitado/largo) conforme solicitação do usuário
  const savedLayout = localStorage.getItem("sectorsLayoutPreference") || "list";
  applyLayout(savedLayout);
  
  btnGrid.addEventListener("click", () => applyLayout("grid"));
  btnList.addEventListener("click", () => applyLayout("list"));
  
  function applyLayout(layout) {
    if (layout === "list") {
      sectorsGrid.classList.add("list-view");
      btnList.classList.add("active");
      btnGrid.classList.remove("active");
      localStorage.setItem("sectorsLayoutPreference", "list");
    } else {
      sectorsGrid.classList.remove("list-view");
      btnGrid.classList.add("active");
      btnList.classList.remove("active");
      localStorage.setItem("sectorsLayoutPreference", "grid");
    }
  }
}

// Inicializar Ouvintes do Modal de Observações
function initObsModal() {
  if (btnCloseObsModal && obsModal) {
    btnCloseObsModal.addEventListener("click", () => {
      obsModal.classList.add("hidden");
    });
    obsModal.addEventListener("click", (e) => {
      if (e.target === obsModal) {
        obsModal.classList.add("hidden");
      }
    });
  }
}

// Inicialização Geral
document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initTabs();
  initLayoutManager();
  initObsModal();
  
  if (VISUAL_MODE_ONLY) {
    console.log("⚡ Painel de Setores rodando em Modo de Simulação Visual.");
    activeAppointments = [...MOCK_APPOINTMENTS];
    updateTabCounts();
    renderGrid();
  } else {
    fetchAppointments();
    // Polling de 3 segundos para sincronização automática
    setInterval(fetchAppointments, 3000);
  }
});
