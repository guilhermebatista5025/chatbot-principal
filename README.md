# Chatbot Admin Dashboard & CRM

Este projeto é um assistente virtual inteligente para WhatsApp com foco em agendamentos de estética automotiva. Ele inclui um chatbot de atendimento automatizado via WhatsApp e um Painel Administrativo moderno para controle em tempo real, monitoramento de sessões, CRM de clientes, calendário de agendamentos e log do sistema.

## 🚀 Estrutura de Arquivos Reorganizada

Os arquivos foram estruturados para permitir que o frontend (site estático) seja implantado diretamente na **Vercel** de forma independente, enquanto o servidor backend (chatbot) roda de forma persistente.

```
/ (Raiz do Projeto)
├── index.html         <-- Painel Administrativo (Frontend - Vercel)
├── style.css          <-- Estilos Premium do Painel (Frontend - Vercel)
├── app.js             <-- Lógica e integração com a API (Frontend - Vercel)
├── chatbot.js         <-- Servidor Backend Express & WhatsApp Bot (Render/Railway/VPS)
├── config.json        <-- Configurações dinâmicas do Bot
├── db.json            <-- Banco de dados CRM de Clientes (JSON)
├── package.json       <-- Scripts e Dependências Node.js
└── README.md          <-- Este arquivo de documentação
```

---

## 🛠️ Como Funciona o Deploy (Vercel + Backend Persistente)

Como o chatbot do WhatsApp (`whatsapp-web.js` + Puppeteer) requer um navegador Chrome rodando em segundo plano e uma conexão estável permanente de 24 horas, ele **não pode ser hospedado na Vercel** (que usa funções Serverless que morrem após alguns segundos).

A arquitetura de produção ideal é:
1. **Frontend** hospedado gratuitamente na **Vercel** (estático, alta velocidade).
2. **Backend** hospedado em um servidor persistente (ex: **Render**, **Railway**, **Fly.io** ou qualquer **VPS** virtual).

---

### Passo 1: Configurar a URL da API no Frontend

Antes de enviar para a Vercel, você precisa dizer ao frontend onde a sua API (backend) estará hospedada.

1. Abra o arquivo `app.js` da raiz.
2. Na linha 4, localize a constante `API_URL`:
   ```javascript
   const API_URL = "https://seu-backend-do-bot.onrender.com"; // Substitua pela URL da sua API hospedada
   ```
3. Salve o arquivo.

*Nota: Se você deixar a string vazia (`const API_URL = "";`), o painel administrativo assumirá que o frontend e o backend estão na mesma porta (útil para desenvolvimento local).*

---

### Passo 2: Implantar o Frontend na Vercel

1. Suba o seu repositório para o GitHub.
2. Acesse a [Vercel](https://vercel.com/) e faça login.
3. Importe o repositório do projeto.
4. Como `index.html` está diretamente na raiz, a Vercel detectará tudo automaticamente como um site estático comum.
5. Clique em **Deploy**. Seu painel administrativo estará online!

---

### Passo 3: Implantar o Backend (Bot)

Você pode usar plataformas como **Render** ou **Railway**, ou uma **VPS** linux/windows.

#### Requisitos de Produção:
- Node.js versão 18 ou superior.
- Puppeteer requer bibliotecas de sistema do Chromium. Em servidores Linux tradicionais (ex: Render/Railway), você pode precisar adicionar um **Buildpack** do Chromium ou usar um arquivo Docker, mas na maioria dos servidores modernos basta a configuração padrão.
- Porta exposta configurada pela variável de ambiente `PORT` (já tratada no código).

#### Passos para Render/Railway:
1. Conecte o mesmo repositório do GitHub.
2. Crie um novo **Web Service**.
3. Defina o comando de build como `npm install`.
4. Defina o comando de inicialização como `node chatbot.js`.
5. Garanta que a variável `PORT` esteja definida nas variáveis de ambiente da plataforma (o código usará automaticamente).
6. Copie o domínio HTTPS gerado pela plataforma e configure no `app.js` da Vercel (Passo 1).

---

## 💻 Como Rodar Tudo Localmente (Modo Desenvolvimento)

1. Certifique-se de que o `API_URL` em `app.js` esteja configurado como vazio (`""`):
   ```javascript
   const API_URL = "";
   ```
2. No seu terminal, instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   node chatbot.js
   ```
4. O servidor iniciará o robô de WhatsApp e abrirá o Express na porta `3000`.
5. Acesse **[http://localhost:3000](http://localhost:3000)** no seu navegador.
6. Escaneie o QR Code gerado no terminal ou exibido no próprio painel administrativo para ativar o robô.