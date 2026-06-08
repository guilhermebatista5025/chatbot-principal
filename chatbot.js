// =====================================
// IMPORTAÇÕES
// =====================================
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Carregar variáveis de ambiente (.env)
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

// Inicializar cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("seu-projeto-id") || supabaseKey.includes("sua-chave-anon")) {
  console.warn("⚠️ ALERTA: Credenciais do Supabase não configuradas no arquivo .env! A integração com o banco de dados não funcionará até que as credenciais corretas sejam inseridas.");
}

const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder", {
  realtime: {
    transport: ws
  }
});

// =====================================
// INTEGRAÇÃO SUPABASE - FUNÇÕES AUXILIARES
// =====================================
async function getCliente(phone) {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (error) {
      console.error(`❌ Erro ao buscar cliente (${phone}):`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`❌ Erro de conexão ao buscar cliente (${phone}):`, err.message);
    return null;
  }
}

async function getClienteByCpf(cpf) {
  try {
    if (!cpf) return null;
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("cpf", cpf)
      .maybeSingle();
    if (error) {
      console.error(`❌ Erro ao buscar cliente por CPF (${cpf}):`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`❌ Erro de conexão ao buscar cliente por CPF (${cpf}):`, err.message);
    return null;
  }
}

async function saveCliente(clienteData) {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .upsert({
        phone: clienteData.phone,
        nome: clienteData.nome,
        cpf: clienteData.cpf,
        veiculos: clienteData.veiculos,
        created_at: clienteData.timestamp || new Date().toISOString()
      });
    if (error) {
      console.error(`❌ Erro ao salvar cliente no Supabase (${clienteData.phone}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`❌ Erro de conexão ao salvar cliente (${clienteData.phone}):`, err.message);
    return false;
  }
}

async function deleteCliente(phone) {
  try {
    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("phone", phone);
    if (error) {
      console.error(`❌ Erro ao deletar cliente no Supabase (${phone}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`❌ Erro de conexão ao deletar cliente (${phone}):`, err.message);
    return false;
  }
}

async function getTodosClientes() {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("❌ Erro ao buscar todos os clientes no Supabase:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("❌ Erro de conexão ao buscar todos os clientes:", err.message);
    return [];
  }
}

async function saveAgendamento(agendamento) {
  try {
    const { data, error } = await supabase
      .from("agendamentos")
      .insert({
        cliente_phone: agendamento.from,
        pushname: agendamento.pushname,
        servico: agendamento.servico,
        veiculo: agendamento.veiculo,
        placa: agendamento.placa,
        porte: agendamento.porte,
        sujeira: agendamento.sujeira,
        agendamento_dia: agendamento.agendamentoDia,
        agendamento_turno: agendamento.agendamentoTurno,
        agendamento_data_valor: agendamento.agendamentoDataValor,
        pagamento: agendamento.pagamento,
        valor_final: agendamento.valorFinal,
        observacoes: agendamento.observacoes || "",
        respostas: agendamento.respostas || [],
        timestamp: agendamento.timestamp || new Date().toISOString()
      });
    if (error) {
      console.error("❌ Erro ao salvar agendamento no Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("❌ Erro de conexão ao salvar agendamento:", err.message);
    return false;
  }
}

async function getTodosAgendamentos() {
  try {
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .order("timestamp", { ascending: false });
    if (error) {
      console.error("❌ Erro ao buscar agendamentos no Supabase:", error.message);
      return [];
    }
    return (data || []).map(row => ({
      from: row.cliente_phone,
      pushname: row.pushname,
      servico: row.servico,
      veiculo: row.veiculo,
      placa: row.placa,
      porte: row.porte,
      sujeira: row.sujeira,
      agendamentoDia: row.agendamento_dia,
      agendamentoTurno: row.agendamento_turno,
      agendamentoDataValor: row.agendamento_data_valor,
      pagamento: row.pagamento,
      valorFinal: row.valor_final,
      observacoes: row.observacoes,
      respostas: row.respostas,
      timestamp: row.timestamp
    }));
  } catch (err) {
    console.error("❌ Erro de conexão ao buscar agendamentos:", err.message);
    return [];
  }
}

// =====================================
// CONFIGURAÇÃO DO EXPRESS
// =====================================
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Habilitar CORS para permitir que o frontend na Vercel se comunique com a API
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Servir pastas de assets públicos de forma individual e segura
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/img", express.static(path.join(__dirname, "img")));
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Servir os arquivos específicos do frontend na raiz
app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});
app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "assets", "favicon.png"), (err) => {
    if (err) {
      res.sendStatus(404);
    }
  });
});

// =====================================
// CARREGAMENTO CONFIGURAÇÃO DINÂMICA
// =====================================
const CONFIG_PATH = path.join(__dirname, "config.json");
let botConfig = {};

async function loadDatabase() {
  try {
    console.log("⚙️ Conectando ao Supabase e carregando cache inicial...");
    const appointments = await getTodosAgendamentos();
    completedAppointments.length = 0;
    completedAppointments.push(...appointments.slice(0, 100).reverse());
    console.log(`⚙️ Cache inicial carregado do Supabase. Agendamentos em cache: ${completedAppointments.length}`);
  } catch (error) {
    console.error("⚠️ Erro ao carregar cache do Supabase:", error.message);
  }
}

async function loadConfig() {
  try {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      botConfig = {
        nomeEmpresa: data.nome_empresa,
        saudacaoAdicional: data.saudacao_adicional,
        mensagemFinal: data.mensagem_final,
        formasPagamento: data.formas_pagamento || [],
        todosServicos: data.todos_servicos || [],
        servicos: data.servicos || {},
        sujeiraAdicionais: data.sujeira_adicionais || {},
        endereco: data.endereco || "",
        linkMapa: data.link_mapa || "",
        horarioManha: data.horario_manha || "08:00 às 12:00",
        horarioTarde: data.horario_tarde || "13:00 às 17:00"
      };
      console.log("⚙️ Configurações dinâmicas carregadas do Supabase com sucesso.");
    } else {
      console.warn("⚠️ Tabela configuracoes vazia no Supabase. Usando fallback local.");
      loadConfigFallback();
    }
  } catch (error) {
    console.error("❌ Erro ao carregar configurações do Supabase:", error.message);
    loadConfigFallback();
  }
}

function loadConfigFallback() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      botConfig = JSON.parse(raw);
      console.log("⚙️ Configurações dinâmicas de fallback carregadas do arquivo local.");
    } else {
      throw new Error("Arquivo config.json não encontrado");
    }
  } catch (error) {
    console.error("⚠️ Erro ao carregar config.json local, usando padrão em memória:", error.message);
    botConfig = {
      nomeEmpresa: "AUTO SPORT ESTÉTICA AUTOMOTIVA",
      saudacaoAdicional: "Escolha uma opção abaixo para continuar:",
      mensagemFinal: "Nossa equipe entrará em contato para confirmar o horário.",
      formasPagamento: [
        "PIX (5% Desconto)",
        "Cartão de Crédito",
        "Cartão de Débito",
        "Dinheiro",
        "Pagar Presencial"
      ],
      todosServicos: [
        "Lavagem Técnica Detalhada",
        "Higienização e Detalhamento Interno",
        "Polimento Técnico & Lustro",
        "Vitrificação de Pintura 9H",
        "Verniz e Detalhamento de Motor",
        "Revitalização de Faróis"
      ],
      servicos: {
        "1": {
          "nome": "Lavagem Técnica Detalhada",
          "precos": { "Pequeno": 80, "Médio": 100, "SUV": 130, "Caminhonete": 150 }
        }
      },
      sujeiraAdicionais: {
        "Leve": 0,
        "Moderada": 30,
        "Pesada": 80
      },
      endereco: "Rua Exemplo, 123 - Centro",
      linkMapa: "https://maps.google.com"
    };
  }
}

async function saveConfig(newConfig) {
  try {
    const { error } = await supabase
      .from("configuracoes")
      .upsert({
        id: 1,
        nome_empresa: newConfig.nomeEmpresa,
        saudacao_adicional: newConfig.saudacaoAdicional,
        mensagem_final: newConfig.mensagemFinal,
        formas_pagamento: newConfig.formasPagamento,
        todos_servicos: newConfig.todosServicos,
        servicos: newConfig.servicos,
        sujeira_adicionais: newConfig.sujeiraAdicionais,
        endereco: newConfig.endereco,
        link_mapa: newConfig.linkMapa,
        horario_manha: newConfig.horarioManha || "08:00 às 12:00",
        horario_tarde: newConfig.horarioTarde || "13:00 às 17:00",
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }

    // Backup local
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ Falha ao salvar backup local config.json:", e.message);
    }

    botConfig = newConfig;
    console.log("✅ Configurações salvas e atualizadas no Supabase.");
    return true;
  } catch (error) {
    console.error("❌ Erro ao salvar configurações no Supabase:", error.message);
    // Tenta salvar localmente
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf8");
      botConfig = newConfig;
      return true;
    } catch (localErr) {
      console.error("❌ Erro ao salvar backup local:", localErr.message);
      return false;
    }
  }
}

loadDatabase();
loadConfig();

// =====================================
// SISTEMA DE LOGS EM TEMPO REAL (SSE)
// =====================================
const systemLogs = [];
const sseClients = new Set();

function addLog(message, type = "info") {
  const logEntry = {
    timestamp: new Date().toLocaleTimeString(),
    message: typeof message === "object" ? JSON.stringify(message) : String(message),
    type
  };
  systemLogs.push(logEntry);
  if (systemLogs.length > 100) {
    systemLogs.shift();
  }
  
  const sseData = `data: ${JSON.stringify(logEntry)}\n\n`;
  sseClients.forEach(client => client.write(sseData));
}

// Intercepta console.log e console.error nativos
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  originalLog.apply(console, args);
  addLog(args.join(" "), "info");
};

console.error = function (...args) {
  originalError.apply(console, args);
  addLog(args.join(" "), "error");
};

// =====================================
// ESTADO GLOBAL DO WHATSAPP
// =====================================
let botStatus = "DESCONECTADO"; // DESCONECTADO, QR_CODE, CONECTADO
let latestQrCode = null;
let isLoggingOut = false; // Flag para evitar dupla inicialização durante logout manual
const userState = {};
const completedAppointments = []; // Histórico de agendamentos concluídos com sucesso

// =====================================
// CONFIGURAÇÃO DO CLIENTE WHATSAPP
// =====================================
const client = new Client({
  authStrategy: new LocalAuth(),
  authTimeoutMs: 90000,
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
  },
  qrMaxRetries: 5,
  puppeteer: {
    headless: "new",
    protocolTimeout: 60000,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1280,720",
    ],
  },
});

// =====================================
// EVENTOS DO WHATSAPP
// =====================================
client.on("qr", (qr) => {
  botStatus = "QR_CODE";
  latestQrCode = qr;
  console.log("📲 Escaneie o QR Code abaixo:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  botStatus = "CONECTADO";
  latestQrCode = null;
  console.log("✅ Tudo certo! WhatsApp conectado.");
});

client.on("disconnected", (reason) => {
  botStatus = "DESCONECTADO";
  latestQrCode = null;
  console.log("⚠️ Desconectado:", reason);

  if (isLoggingOut) {
    console.log("ℹ️ Desconexão manual solicitada. O fluxo de logout gerenciará a re-inicialização.");
    isLoggingOut = false;
    return;
  }

  // Tentar re-inicializar após um delay para resiliência (ex: queda de rede ou max qr retries)
  console.log("🔄 Conexão perdida ou expirada. Tentando reiniciar o WhatsApp em 5 segundos...");
  setTimeout(() => {
    client.initialize().catch((err) => {
      console.error("❌ Erro ao reiniciar o cliente após desconexão:", err);
    });
  }, 5000);
});

// Inicialização do cliente com tratamento de erros
client.initialize().catch((err) => {
  console.error("❌ Erro ao inicializar o cliente WhatsApp:", err);
});

// =====================================
// FUNÇÃO DE DELAY E DIGITAÇÃO
// =====================================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Retorna os próximos dias úteis de atendimento (excluindo Domingos)
function getNextWorkingDays(count = 6) {
  const days = [];
  const ptDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  
  let current = new Date();
  // Começamos a partir de amanhã
  current.setDate(current.getDate() + 1);
  
  while (days.length < count) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0) { // Ignora Domingos
      const dateStr = current.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      const fullDate = `${yyyy}-${mm}-${dd}`;
      days.push({
        label: `${ptDays[dayOfWeek]} (${dateStr})`,
        value: fullDate
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// =====================================
// FUNÇÃO DE AUXÍLIO: ENVIAR E REGISTRAR MENSAGENS DO BOT
// =====================================
async function sendBotMessage(to, text) {
  try {
    await client.sendMessage(to, text);
    if (userState[to]) {
      if (!userState[to].respostas) {
        userState[to].respostas = [];
      }
      userState[to].respostas.push({
        autor: "bot",
        texto: text,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem do bot e registrar histórico:", err);
  }
}

// =====================================
// FUNIL DE MENSAGENS (SOMENTE PRIVADO)
// =====================================
client.on("message", async (msg) => {
  try {
    // ❌ IGNORA GRUPOS
    if (!msg.from || msg.from.endsWith("@g.us")) return;

    // Resolva o JID real se for um número fictício do tipo @lid (Linked Device JID)
    let contact = null;
    try {
      contact = await msg.getContact();
      if (contact && contact.id && contact.id._serialized) {
        if (contact.id._serialized.endsWith("@c.us") && msg.from.endsWith("@lid")) {
          console.log(`🔄 Resolvendo número fictício LID [${msg.from}] para o número real [${contact.id._serialized}]`);
          Object.defineProperty(msg, "from", {
            value: contact.id._serialized,
            writable: true,
            configurable: true,
            enumerable: true
          });
        }
      }
    } catch (contactErr) {
      console.error("⚠️ Erro ao resolver contato real para", msg.from, ":", contactErr.message);
    }

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const texto = msg.body ? msg.body.trim().toLowerCase() : "";

    // FUNÇÃO DE DIGITAÇÃO SIMULADA
    const typing = async () => {
      await delay(800);
      await chat.sendStateTyping();
      await delay(1200);
    };

    // Registra a mensagem recebida se o usuário já tiver uma sessão ativa
    if (userState[msg.from]) {
      if (!userState[msg.from].respostas) {
        userState[msg.from].respostas = [];
      }
      userState[msg.from].respostas.push({
        autor: "cliente",
        texto: msg.body || "",
        timestamp: new Date().toISOString()
      });
    }

    // =====================================
    // DETECTOR DE PALAVRAS CHAVE DE MENU INICIAL
    // =====================================
    const isKeyword = /^(menu|oi|olá|ola|bom dia|boa tarde|boa noite)$/i.test(texto);

    if (isKeyword) {
      await typing();
      
      const hora = new Date().getHours();
      let saudacao = "Olá";
      if (hora >= 5 && hora < 12) saudacao = "Bom dia";
      else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
      else saudacao = "Boa noite";

      // Verifica se o cliente já está cadastrado no CRM do Supabase
      const cliente = await getCliente(msg.from);

      if (cliente) {
        // CLIENTE CADASTRADO: Boas-vindas personalizadas!
        userState[msg.from] = {
          from: msg.from,
          pushname: cliente.nome,
          etapa: "menu",
          timestamp: new Date().toISOString(),
          respostas: [
            { autor: "cliente", texto: msg.body || "", timestamp: new Date().toISOString() }
          ]
        };

        await sendBotMessage(
          msg.from,
          `Olá, *${cliente.nome}*! 👋 Que bom ver você de volta na *${botConfig.nomeEmpresa}*! 🚗💎\n\n` +
          `Como posso te ajudar hoje? Selecione uma opção:\n\n` +
          `1️⃣ Agendar um Serviço\n` +
          `2️⃣ Ver Serviços e Preços\n` +
          `3️⃣ Formas de Pagamento\n` +
          `4️⃣ Nossa Localização`
        );
      } else {
        // CLIENTE NOVO: Inicia cadastro!
        const whatsappName = msg.pushname || (contact ? contact.pushname : null) || "Cliente";
        userState[msg.from] = {
          from: msg.from,
          pushname: whatsappName,
          etapa: "reg_nome",
          timestamp: new Date().toISOString(),
          respostas: [
            { autor: "cliente", texto: msg.body || "", timestamp: new Date().toISOString() }
          ]
        };

        await sendBotMessage(
          msg.from,
          `${saudacao}! 👋 Seja muito bem-vindo à *${botConfig.nomeEmpresa}*!\n\n` +
          `Identifiquei que este é seu *primeiro contato* conosco. Para te fornecer orçamentos rápidos e agendamentos sob medida, vamos fazer um cadastro super rápido. 🚀\n\n` +
          `✍️ *Por favor, digite o seu nome completo:*`
        );
      }
      return;
    }

    // =====================================
    // FLUXO DE CADASTRO - NOVO CLIENTE (CRM)
    // =====================================

    // Passo 1: Recebe Nome Completo
    if (userState[msg.from]?.etapa === "reg_nome") {
      const nome = msg.body.trim();
      userState[msg.from].nome = nome;
      userState[msg.from].etapa = "reg_cpf";
      
      await typing();
      await sendBotMessage(
        msg.from,
        `Prazer em te conhecer, *${nome}*! 😊\n\n` +
        `Agora, por favor, informe o seu *CPF* (apenas números ou formatado):`
      );
      return;
    }

    // Passo 2: Recebe CPF (Valida se já está cadastrado no Supabase)
    if (userState[msg.from]?.etapa === "reg_cpf") {
      const cpf = msg.body.trim();
      const cleanCpf = cpf.replace(/\D/g, "");

      if (cleanCpf) {
        const cpfExistente = await getClienteByCpf(cleanCpf);
        if (cpfExistente && cpfExistente.phone !== msg.from) {
          await typing();
          await sendBotMessage(
            msg.from,
            `⚠️ *Atenção:* Já identificamos um cadastro ativo com este CPF para outro número de telefone (${cpfExistente.phone}).\n\n` +
            `Por favor, informe outro CPF válido para continuar seu cadastro:`
          );
          return;
        }
      }

      userState[msg.from].cpf = cpf;
      userState[msg.from].etapa = "reg_quantos";

      await typing();
      await sendBotMessage(
        msg.from,
        `Perfeito! Cadastro quase concluído. 🚀\n\n` +
        `🚘 *Quantos veículos você gostaria de cadastrar no seu nome hoje?* (Digite um número de 1 a 5)`
      );
      return;
    }

    // Passo 3: Recebe quantidade de carros
    if (userState[msg.from]?.etapa === "reg_quantos") {
      const quantos = parseInt(texto);
      if (isNaN(quantos) || quantos < 1 || quantos > 5) {
        await sendBotMessage(msg.from, "❌ Por favor, digite uma quantidade válida de 1 a 5.");
        return;
      }
      userState[msg.from].veiculosTempCount = quantos;
      userState[msg.from].veiculosTempIndex = 0;
      userState[msg.from].veiculosTemp = [];
      userState[msg.from].etapa = "reg_modelo";

      await typing();
      await sendBotMessage(
        msg.from,
        `Excelente! Vamos cadastrar o *veículo 1* de ${quantos}.\n\n` +
        `🚘 *Qual é o modelo e marca do carro?* (Ex: Corolla, Onix, Jeep Compass...)`
      );
      return;
    }

    // Passo 4a: Recebe Modelo do carro no Loop
    if (userState[msg.from]?.etapa === "reg_modelo") {
      const index = userState[msg.from].veiculosTempIndex;
      userState[msg.from].veiculosTemp[index] = { modelo: msg.body.trim() };
      userState[msg.from].etapa = "reg_placa";

      await typing();
      await sendBotMessage(
        msg.from,
        `Show! E qual é a *placa* deste veículo? (Ex: ABC-1234)`
      );
      return;
    }

    // Passo 4b: Recebe Placa do carro no Loop
    if (userState[msg.from]?.etapa === "reg_placa") {
      const index = userState[msg.from].veiculosTempIndex;
      userState[msg.from].veiculosTemp[index].placa = msg.body.trim().toUpperCase();
      userState[msg.from].etapa = "reg_porte";

      await typing();
      await sendBotMessage(
        msg.from,
        `Qual é o *porte/categoria* deste veículo? (Selecione o número correspondente):\n\n` +
        `1️⃣ *Pequeno* (Hatch/Compacto, Ex: Onix, HB20, Kwid)\n` +
        `2️⃣ *Médio* (Sedan/Médio, Ex: Corolla, Civic, Cruze)\n` +
        `3️⃣ *Grande* (SUV/Crossover, Ex: Compass, Renegade, Creta)\n` +
        `4️⃣ *Extra Grande* (Caminhonete/Picape/Van, Ex: Hilux, Toro, Ranger)`
      );
      return;
    }

    // Passo 4c: Recebe Porte e decide se continua o cadastro
    if (userState[msg.from]?.etapa === "reg_porte") {
      const index = userState[msg.from].veiculosTempIndex;
      const portes = {
        "1": "Pequeno",
        "2": "Médio",
        "3": "Grande",
        "4": "Caminhonete"
      };
      const porte = portes[texto];
      if (!porte) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de porte válida (1 a 4).");
        return;
      }
      userState[msg.from].veiculosTemp[index].porte = porte;

      // Avança o loop
      userState[msg.from].veiculosTempIndex++;
      const nextIndex = userState[msg.from].veiculosTempIndex;
      const total = userState[msg.from].veiculosTempCount;

      await typing();

      if (nextIndex < total) {
        // Continua cadastrando
        userState[msg.from].etapa = "reg_modelo";
        await sendBotMessage(
          msg.from,
          `Ótimo! Vamos cadastrar o *veículo ${nextIndex + 1}* de ${total}.\n\n` +
          `🚘 *Qual é o modelo e marca do carro?*`
        );
      } else {
        // Cadastro completo! Salva no banco Supabase
        const clienteData = {
          phone: msg.from,
          nome: userState[msg.from].nome,
          cpf: userState[msg.from].cpf,
          timestamp: new Date().toISOString(),
          veiculos: userState[msg.from].veiculosTemp
        };

        await saveCliente(clienteData);

        // Limpa chaves temporárias
        delete userState[msg.from].veiculosTemp;
        delete userState[msg.from].veiculosTempCount;
        delete userState[msg.from].veiculosTempIndex;

        // Ativa o Menu Principal
        userState[msg.from].etapa = "menu";

        await sendBotMessage(
          msg.from,
          `🎉 *CADASTRO CONCLUÍDO COM SUCESSO!*\n\n` +
          `Seja muito bem-vindo à família *${botConfig.nomeEmpresa}*, ${clienteData.nome}! 🚗💎\n\n` +
          `Como posso te ajudar hoje? Selecione uma opção:\n\n` +
          `1️⃣ Agendar um Serviço\n` +
          `2️⃣ Ver Serviços e Preços\n` +
          `3️⃣ Formas de Pagamento\n` +
          `4️⃣ Nossa Localização`
        );
      }
      return;
    }

    // =====================================
    // CADASTRO DE VEÍCULO ADICIONAL (Para cliente recorrente)
    // =====================================
    if (userState[msg.from]?.etapa === "reg_adicional_modelo") {
      userState[msg.from].veiculoTemp = { modelo: msg.body.trim() };
      userState[msg.from].etapa = "reg_adicional_placa";

      await typing();
      await sendBotMessage(msg.from, `Show! E qual é a *placa* deste novo veículo? (Ex: ABC-1234)`);
      return;
    }

    if (userState[msg.from]?.etapa === "reg_adicional_placa") {
      userState[msg.from].veiculoTemp.placa = msg.body.trim().toUpperCase();
      userState[msg.from].etapa = "reg_adicional_porte";

      await typing();
      await sendBotMessage(
        msg.from,
        `Qual é o *porte/categoria* deste novo veículo?\n\n` +
        `1️⃣ *Pequeno* (Hatch)\n` +
        `2️⃣ *Médio* (Sedan)\n` +
        `3️⃣ *Grande* (SUV)\n` +
        `4️⃣ *Extra Grande* (Caminhonete)`
      );
      return;
    }

    if (userState[msg.from]?.etapa === "reg_adicional_porte") {
      const portes = {
        "1": "Pequeno",
        "2": "Médio",
        "3": "Grande",
        "4": "Caminhonete"
      };
      const porte = portes[texto];
      if (!porte) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de porte válida (1 a 4).");
        return;
      }
      userState[msg.from].veiculoTemp.porte = porte;

      // Adiciona o veículo novo na ficha do cliente no Supabase
      const cliente = await getCliente(msg.from);
      if (cliente) {
        if (!cliente.veiculos) cliente.veiculos = [];
        cliente.veiculos.push(userState[msg.from].veiculoTemp);
        await saveCliente(cliente);
      }

      // Salva na sessão do agendamento
      userState[msg.from].veiculo = userState[msg.from].veiculoTemp.modelo;
      userState[msg.from].placa = userState[msg.from].veiculoTemp.placa;
      userState[msg.from].porte = userState[msg.from].veiculoTemp.porte;

      delete userState[msg.from].veiculoTemp;

      // Avança diretamente para a escolha de serviços!
      userState[msg.from].etapa = "servico";
      userState[msg.from].timestamp = new Date().toISOString();

      await typing();

      let listagemServicos = "";
      Object.keys(botConfig.servicos).forEach((key) => {
        listagemServicos += `${key}️⃣ *${botConfig.servicos[key].nome}*\n`;
      });

      await sendBotMessage(
        msg.from,
        `🧼 *Selecione o serviço desejado:*\n\n` + listagemServicos.trim()
      );
      return;
    }

    // =====================================
    // PROCESSAMENTO DO MENU PRINCIPAL
    // =====================================
    if (userState[msg.from]?.etapa === "menu") {
      
      // 1. SOLICITAR AGENDAMENTO (Escolha do Carro)
      if (texto === "1") {
        const cliente = await getCliente(msg.from);
        await typing();

        if (cliente && cliente.veiculos && cliente.veiculos.length > 0) {
          userState[msg.from].etapa = "selecionar_veiculo";
          userState[msg.from].timestamp = new Date().toISOString();

          let listagemVeiculos = "";
          cliente.veiculos.forEach((v, idx) => {
            listagemVeiculos += `${idx + 1}️⃣ *${v.modelo}* [${v.placa}] (${v.porte})\n`;
          });
          listagemVeiculos += `${cliente.veiculos.length + 1}️⃣ Cadastrar um novo veículo`;

          await sendBotMessage(
            msg.from,
            `🚗 *Qual veículo você trará para realizar o serviço hoje?*\n\n` + listagemVeiculos.trim()
          );
        } else {
          // Segurança (Se não tiver veículo por algum motivo, cadastra um)
          userState[msg.from].veiculosTempCount = 1;
          userState[msg.from].veiculosTempIndex = 0;
          userState[msg.from].veiculosTemp = [];
          userState[msg.from].etapa = "reg_modelo";
          await sendBotMessage(msg.from, `🚘 *Qual é o modelo e marca do seu veículo?*`);
        }
        return;
      }

      // 2. VER TODOS OS SERVIÇOS E PREÇOS
      if (texto === "2") {
        await typing();

        let listagemTodos = "";
        Object.keys(botConfig.servicos).forEach((key) => {
          const item = botConfig.servicos[key];
          listagemTodos += `✔️ *${item.nome}*:\n` +
            `   _Pequeno: R$ ${item.precos.Pequeno},00_ | _Médio: R$ ${item.precos.Médio},00_\n` +
            `   _Grande: R$ ${item.precos.Grande},00_ | _Extra: R$ ${item.precos.Caminhonete},00_\n\n`;
        });

        await sendBotMessage(
          msg.from,
          `🚘 *Nosso Portfólio & Tabela Base de Preços:*\n\n` + listagemTodos.trim()
        );
        return;
      }

      // 3. VER FORMAS DE PAGAMENTO
      if (texto === "3") {
        await typing();

        let listagemPags = "";
        botConfig.formasPagamento.forEach((p) => {
          listagemPags += `✔️ ${p}\n`;
        });

        await sendBotMessage(
          msg.from,
          `💳 *Formas de pagamento suportadas:*\n\n` + listagemPags.trim() +
          `\n\n*💡 Dica:* Pagamentos via PIX possuem *5% de desconto automático*!`
        );
        return;
      }

      // 4. VER LOCALIZAÇÃO
      if (texto === "4") {
        await typing();

        await sendBotMessage(
          msg.from,
          `📍 *Estamos localizados em:*\n\n` +
          `${botConfig.endereco}\n\n` +
          `🗺️ Clique aqui para abrir a rota no GPS: ${botConfig.linkMapa}`
        );
        return;
      }
    }

    // =====================================
    // SELECIONAR VEÍCULO CADASTRADO
    // =====================================
    if (userState[msg.from]?.etapa === "selecionar_veiculo") {
      const cliente = await getCliente(msg.from);
      const index = parseInt(texto) - 1;

      await typing();

      // Escolheu cadastrar veículo novo
      if (index === cliente.veiculos.length) {
        userState[msg.from].veiculoTemp = {};
        userState[msg.from].etapa = "reg_adicional_modelo";
        await sendBotMessage(msg.from, `🚘 *Qual é o modelo e marca do carro adicional?*`);
        return;
      }

      const veiculo = cliente.veiculos[index];
      if (!veiculo) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de veículo válida.");
        return;
      }

      // Salva dados do veículo na sessão ativa
      userState[msg.from].veiculo = veiculo.modelo;
      userState[msg.from].placa = veiculo.placa;
      userState[msg.from].porte = veiculo.porte;

      // Vai para a escolha do serviço
      userState[msg.from].etapa = "servico";
      userState[msg.from].timestamp = new Date().toISOString();

      let listagemServicos = "";
      Object.keys(botConfig.servicos).forEach((key) => {
        listagemServicos += `${key}️⃣ *${botConfig.servicos[key].nome}*\n`;
      });

      await sendBotMessage(
        msg.from,
        `🧼 *Selecione o serviço desejado para o seu ${veiculo.modelo}:*\n\n` + listagemServicos.trim()
      );
      return;
    }

    // =====================================
    // SELEÇÃO DO SERVIÇO & CÁLCULO BASE
    // =====================================
    if (userState[msg.from]?.etapa === "servico") {
      const item = botConfig.servicos[texto];

      if (!item) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção válida.");
        return;
      }

      userState[msg.from].servico = item.nome;
      
      const porteCarro = userState[msg.from].porte || "Médio";
      const precoBase = item.precos[porteCarro] || 100;
      userState[msg.from].precoBase = precoBase;

      userState[msg.from].etapa = "sujeira";
      userState[msg.from].timestamp = new Date().toISOString();

      await typing();

      await sendBotMessage(
        msg.from,
        `🧼 *Qual é o nível de sujeira atual do veículo?*\n` +
        `_(Ajuda a calcular o tempo de execução e adicionais)_\n\n` +
        `1️⃣ *Leve* (Sujeira comum de poeira/chuva - Sem adicional)\n` +
        `2️⃣ *Moderada* (Manchas leves, terra de passeio, pelos de pet - +R$ 30,00)\n` +
        `3️⃣ *Pesada* (Barro grosso, pelos de pet extremos ou manchas profundas - +R$ 80,00)`
      );
      return;
    }

    // =====================================
    // SELEÇÃO DA SUJEIRA & CÁLCULO FINAL
    // =====================================
    if (userState[msg.from]?.etapa === "sujeira") {
      const opcoesSujeira = {
        "1": "Leve",
        "2": "Moderada",
        "3": "Pesada"
      };

      const sujeira = opcoesSujeira[texto];
      if (!sujeira) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de sujeira válida (1 a 3).");
        return;
      }

      userState[msg.from].sujeira = sujeira;
      const adicional = botConfig.sujeiraAdicionais[sujeira] || 0;
      userState[msg.from].adicionalSujeira = adicional;

      const precoFinal = userState[msg.from].precoBase + adicional;
      userState[msg.from].valorFinal = precoFinal;

      userState[msg.from].etapa = "agendamento_data";
      userState[msg.from].timestamp = new Date().toISOString();

      const workingDays = getNextWorkingDays(6);
      userState[msg.from].workingDaysTemp = workingDays;

      let listagemDias = "🗓️ *Escolha o dia de sua preferência para trazer o carro:*\n\n";
      workingDays.forEach((d, idx) => {
        listagemDias += `${idx + 1}️⃣ ${d.label}\n`;
      });

      await typing();
      await sendBotMessage(msg.from, listagemDias.trim());
      return;
    }

    // =====================================
    // AGENDAMENTO DATA
    // =====================================
    if (userState[msg.from]?.etapa === "agendamento_data") {
      const idx = parseInt(texto) - 1;
      const days = userState[msg.from].workingDaysTemp;
      if (!days || !days[idx]) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de dia válida (1 a 6).");
        return;
      }
      
      const diaSelecionado = days[idx];
      userState[msg.from].agendamentoDia = diaSelecionado.label;
      userState[msg.from].agendamentoDataValor = diaSelecionado.value; // ex: "2026-05-25"
      
      delete userState[msg.from].workingDaysTemp; // Limpa a lista temporária da sessão
      
      userState[msg.from].etapa = "agendamento_turno";
      userState[msg.from].timestamp = new Date().toISOString();

      await typing();
      await sendBotMessage(
        msg.from,
        `⏱️ *Qual período do dia você prefere?*\n\n` +
        `1️⃣ Manhã (${botConfig.horarioManha || "08:00 às 12:00"})\n` +
        `2️⃣ Tarde (${botConfig.horarioTarde || "13:00 às 17:00"})`
      );
      return;
    }

    // =====================================
    // AGENDAMENTO TURNO
    // =====================================
    if (userState[msg.from]?.etapa === "agendamento_turno") {
      const turnos = {
        "1": `Manhã (${botConfig.horarioManha || "08:00 às 12:00"})`,
        "2": `Tarde (${botConfig.horarioTarde || "13:00 às 17:00"})`
      };
      const turno = turnos[texto];
      if (!turno) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção válida (1 ou 2).");
        return;
      }
      userState[msg.from].agendamentoTurno = turno;

      userState[msg.from].etapa = "pagamento";
      userState[msg.from].timestamp = new Date().toISOString();

      await typing();

      let listagemFormas = "";
      botConfig.formasPagamento.forEach((p, idx) => {
        listagemFormas += `${idx + 1}️⃣ ${p}\n`;
      });

      await sendBotMessage(
        msg.from,
        `💳 *Escolha a forma de pagamento preferida:*\n\n` + listagemFormas.trim()
      );
      return;
    }

    // =====================================
    // SELEÇÃO DE PAGAMENTO & FINALIZAÇÃO
    // =====================================
    if (userState[msg.from]?.etapa === "pagamento") {
      const indice = parseInt(texto) - 1;
      const pagamento = botConfig.formasPagamento[indice];

      if (!pagamento) {
        await sendBotMessage(msg.from, "❌ Escolha uma opção de pagamento válida.");
        return;
      }

      userState[msg.from].pagamento = pagamento;
      userState[msg.from].timestamp = new Date().toISOString();
      const dados = userState[msg.from];

      // Aplica 5% de desconto de simulação se for PIX
      let precoFinal = dados.valorFinal;
      if (pagamento.toUpperCase().includes("PIX")) {
        precoFinal = Math.round(precoFinal * 0.95);
      }

      const novoAgendamento = {
        from: dados.from,
        pushname: dados.pushname || "Cliente",
        servico: dados.servico,
        veiculo: `${dados.veiculo} [${dados.placa || "N/A"}]`,
        placa: dados.placa || "N/A",
        porte: dados.porte || "N/A",
        sujeira: dados.sujeira || "N/A",
        agendamentoDia: dados.agendamentoDia || "N/A",
        agendamentoTurno: dados.agendamentoTurno || "N/A",
        agendamentoDataValor: dados.agendamentoDataValor || "N/A",
        pagamento: pagamento,
        valorFinal: precoFinal,
        timestamp: dados.timestamp,
        respostas: dados.respostas || []
      };

      // Salva no histórico de agendamentos concluídos (memória cache)
      completedAppointments.push(novoAgendamento);
      if (completedAppointments.length > 100) {
        completedAppointments.shift();
      }

      // Salva no banco de dados do Supabase
      await saveAgendamento(novoAgendamento);

      await typing();

      await sendBotMessage(
        msg.from,
        `✅ *AGENDAMENTO REALIZADO COM SUCESSO!* 🎉\n\n` +
        `🚗 Serviço: *${dados.servico}*\n` +
        `🚘 Veículo: *${dados.veiculo}* [${dados.placa || "N/A"}] (${dados.porte})\n` +
        `🧼 Nível de Sujeira: *${dados.sujeira}*\n` +
        `🗓️ Período: *${dados.agendamentoDia} (${dados.agendamentoTurno})*\n` +
        `💳 Pagamento: *${pagamento}*\n` +
        `💰 *Valor Estimado: R$ ${precoFinal},00*\n\n` +
        `📲 ${botConfig.mensagemFinal}`
      );

      // Limpa estado do usuário ativo
      delete userState[msg.from];
      return;
    }

  } catch (error) {
    console.error("❌ Erro no processamento da mensagem:", error);
  }
});

// =====================================
// ENDPOINTS DA API ADMINISTRATIVA
// =====================================

// Status atual do Whatsapp
app.get("/api/status", (req, res) => {
  res.json({
    status: botStatus,
    qr: latestQrCode,
    info: client.info ? {
      pushname: client.info.pushname,
      wid: client.info.wid
    } : null
  });
});

// Ler configurações salvas
app.get("/api/config", async (req, res) => {
  await loadConfig();
  res.json(botConfig);
});

// Salvar configurações
app.post("/api/config", async (req, res) => {
  const success = await saveConfig(req.body);
  if (success) {
    res.json({ success: true, message: "Configurações atualizadas com sucesso!" });
  } else {
    res.status(500).json({ success: false, message: "Erro ao gravar configurações no banco de dados." });
  }
});

// Lista de conversas / sessões ativas no funil
app.get("/api/sessions", (req, res) => {
  res.json(Object.values(userState));
});

// Lista todos os clientes cadastrados no CRM
app.get("/api/clients", async (req, res) => {
  const clientes = await getTodosClientes();
  res.json(clientes);
});

// Deletar um cliente do CRM
app.post("/api/clients/delete", async (req, res) => {
  const { phone } = req.body;
  if (phone) {
    const success = await deleteCliente(phone);
    if (success) {
      console.log(`🧹 Cliente removido do CRM pelo administrador: ${phone}`);
      res.json({ success: true, message: "Cliente removido com sucesso de forma definitiva." });
    } else {
      res.status(500).json({ success: false, message: "Erro ao remover cliente do Supabase." });
    }
  } else {
    res.status(400).json({ success: false, message: "Número de telefone não informado." });
  }
});

// Retorna o histórico de agendamentos concluídos
app.get("/api/appointments", async (req, res) => {
  const appointments = await getTodosAgendamentos();
  res.json(appointments);
});

// Novo endpoint para receber agendamentos realizados via Website
app.post("/api/appointments", async (req, res) => {
  const { 
    from, 
    pushname, 
    cpf,
    servico, 
    veiculo, 
    placa, 
    porte, 
    sujeira, 
    agendamentoDia, 
    agendamentoTurno, 
    agendamentoDataValor, 
    pagamento, 
    valorFinal,
    observacoes
  } = req.body;

  if (!from || !servico || !veiculo || !pushname) {
    return res.status(400).json({ success: false, message: "Campos obrigatórios ausentes (from, pushname, servico, veiculo)." });
  }

  // Formata o número de telefone no padrão do WhatsApp do bot
  let rawPhone = from.replace(/\D/g, "");
  if (!rawPhone.startsWith("55")) {
    rawPhone = "55" + rawPhone;
  }
  const formattedPhone = `${rawPhone}@c.us`;

  const veiculoFormatado = {
    modelo: veiculo,
    placa: (placa || "N/A").toUpperCase(),
    porte: porte || "Médio"
  };

  try {
    // 1. Integração com CRM: Verifica/Salva Cliente no Supabase
    let cliente = await getCliente(formattedPhone);
    if (!cliente) {
      // Cliente novo: Cria cadastro
      cliente = {
        phone: formattedPhone,
        nome: pushname,
        cpf: cpf || null,
        timestamp: new Date().toISOString(),
        veiculos: [veiculoFormatado]
      };
      await saveCliente(cliente);
      console.log(`👤 Novo cliente cadastrado no CRM via Website: ${pushname} (${formattedPhone})`);
    } else {
      // Cliente recorrente: Verifica se o veículo já está cadastrado
      const jaCadastrado = cliente.veiculos && cliente.veiculos.some(
        v => v.placa.replace(/\D/g, "") === veiculoFormatado.placa.replace(/\D/g, "")
      );
      if (!jaCadastrado) {
        if (!cliente.veiculos) cliente.veiculos = [];
        cliente.veiculos.push(veiculoFormatado);
        await saveCliente(cliente);
        console.log(`🚗 Novo veículo [${veiculoFormatado.modelo}] vinculado ao cliente CRM: ${pushname}`);
      }
    }

    // 2. Criação do Agendamento Confirmado no Painel
    const novoAgendamento = {
      from: formattedPhone,
      pushname: pushname,
      servico: servico,
      veiculo: `${veiculo} [${(placa || "N/A").toUpperCase()}]`,
      placa: (placa || "N/A").toUpperCase(),
      porte: porte || "N/A",
      sujeira: sujeira || "N/A",
      agendamentoDia: agendamentoDia || "N/A",
      agendamentoTurno: agendamentoTurno || "N/A",
      agendamentoDataValor: agendamentoDataValor || "N/A",
      pagamento: pagamento || "N/A",
      valorFinal: valorFinal || 0,
      observacoes: observacoes || "N/A",
      timestamp: new Date().toISOString(),
      respostas: [
        { 
          autor: "cliente", 
          texto: `Agendamento Web realizado com sucesso! Serviços: ${servico}. Carro: ${veiculo} [${placa || "N/A"}]. Período: ${agendamentoDia} (${agendamentoTurno}). Obs: ${observacoes || "Nenhuma"}`, 
          timestamp: new Date().toISOString() 
        }
      ]
    };

    completedAppointments.push(novoAgendamento);
    if (completedAppointments.length > 100) {
      completedAppointments.shift();
    }

    // Salva no banco de dados do Supabase
    await saveAgendamento(novoAgendamento);

    console.log(`📅 Novo agendamento registrado via WEBSITE para ${pushname}: ${servico} (Valor: R$ ${valorFinal},00)`);
    res.json({ success: true, message: "Agendamento registrado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao registrar agendamento via Web:", error);
    res.status(500).json({ success: false, message: "Erro interno no servidor ao registrar agendamento." });
  }
});

// Limpa o histórico de agendamentos concluídos
app.post("/api/appointments/clear", async (req, res) => {
  try {
    const { error } = await supabase.from("agendamentos").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Deleta todos
    completedAppointments.length = 0;
    console.log("🧹 Histórico de agendamentos limpo pelo administrador.");
    res.json({ success: true, message: "Histórico de agendamentos limpo." });
  } catch (err) {
    console.error("❌ Erro ao limpar agendamentos no Supabase:", err);
    res.status(500).json({ success: false, message: "Erro ao limpar histórico no banco de dados." });
  }
});

// Resetar sessão ativa de um usuário
app.post("/api/sessions/reset", (req, res) => {
  const { from } = req.body;
  if (from && userState[from]) {
    delete userState[from];
    console.log(`🧹 Sessão resetada pelo administrador para o número: ${from}`);
    res.json({ success: true, message: "Sessão do cliente redefinida com sucesso." });
  } else {
    res.status(404).json({ success: false, message: "Sessão não encontrada para o número informado." });
  }
});

// Desconectar o WhatsApp (Logout) e forçar re-inicialização
app.post("/api/logout", async (req, res) => {
  try {
    console.log("🛑 Solicitando desconexão do WhatsApp pelo painel administrativo...");
    botStatus = "DESCONECTADO";
    latestQrCode = null;
    isLoggingOut = true; // Evita dupla inicialização disparada pelo evento 'disconnected'
    
    try {
      await client.logout();
    } catch (e) {
      console.log("⚠️ Erro ao chamar client.logout() nativo, forçando encerramento do cliente...");
      try {
        await client.destroy();
      } catch (destroyErr) {
        console.error("⚠️ Erro ao destruir cliente:", destroyErr);
      }
    }
    
    // Inicializa novamente o cliente para gerar um novo QR Code
    client.initialize().catch((err) => {
      console.error("❌ Erro ao reiniciar o cliente WhatsApp após logout:", err);
      isLoggingOut = false;
    });

    res.json({ success: true, message: "Desconexão solicitada. O WhatsApp irá reiniciar e gerar um novo QR Code." });
  } catch (error) {
    console.error("❌ Erro ao deslogar:", error);
    isLoggingOut = false;
    res.status(500).json({ success: false, message: "Erro ao deslogar do WhatsApp." });
  }
});

// Stream de Logs em Tempo Real (SSE)
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Envia logs salvos anteriormente
  systemLogs.forEach((log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Rota para servir a tela de agendamento separada
app.get("/agendar", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "agendar.html"), (err) => {
    if (err) {
      res.status(404).send("Página de agendamento não encontrada.");
    }
  });
});
app.get("/agendar.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "agendar.html"), (err) => {
    if (err) {
      res.status(404).send("Página de agendamento não encontrada.");
    }
  });
});

// Rota para servir a tela de login e cadastro
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "login.html"), (err) => {
    if (err) {
      res.status(404).send("Página de login não encontrada.");
    }
  });
});
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "login.html"), (err) => {
    if (err) {
      res.status(404).send("Página de login não encontrada.");
    }
  });
});

// Rota padrão para servir o site institucional (Painel Administrativo)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), (err) => {
    if (err) {
      res.status(500).send("Erro ao carregar o painel administrativo.");
    }
  });
});
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), (err) => {
    if (err) {
      res.status(500).send("Erro ao carregar o painel administrativo.");
    }
  });
});

// =====================================
// INICIALIZAÇÃO DO SERVIDOR WEB HTTP
// =====================================
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`🌐 Servidor administrativo ativo em: http://localhost:${PORT}`);
});

// Encerramento limpo
process.on("SIGINT", async () => {
  console.log("🛑 Encerrando bot e servidor web...");
  await client.destroy();
  server.close(() => {
    console.log("🌐 Servidor web encerrado.");
    process.exit();
  });
});

// Previne quedas do processo por erros não tratados
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Rejeição de promessa não tratada detectada:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Exceção não capturada detectada:", error);
});