# TEPA Performance Award 2026 — *"Light Up"* (WordPress Theme + Supabase Realtime)

Plataforma digital interactiva para o evento **TEPA Performance Award 2026** da **TotalEnergies** (Quiz de Boas-Vindas, Votação *Best of the Best* entre 15 projectos finalistas, Ecrã 16:9 em Tempo Real no Auditório e Painel de Gestão).

---

## 1. Estrutura do Projecto

| Ficheiro / Pasta | Finalidade |
| :--- | :--- |
| [`tepa-award-theme/`](./tepa-award-theme/) | Tema WordPress completo (Templates Mobile Quiz, Mobile Voting, Ecrã 16:9 Live + Painel WP-Admin). |
| [`tepa-award-theme.zip`](./tepa-award-theme.zip) | Pacote pronto para carregar directamente em **WordPress → Aparência → Temas → Adicionar Novo**. |
| [`supabase/schema.sql`](./supabase/schema.sql) | Script SQL idempotente para o Supabase (Tabelas, RLS, Realtime, Seed de 15 finalistas e 6 perguntas, RPCs atómicas). |
| [`preview/`](./preview/) | Suite de pré-visualização e **Presentation Studio** (`preview/index.html`) funcional em Modo Demo sem precisar de PHP/WordPress. |

---

## 2. Como Apresentar o Protótipo (Reunião de 20/11/2026)

O `preview/index.html` funciona **em tempo real** sem servidor WordPress nem Supabase configurados (usa `BroadcastChannel` + `localStorage` em Modo Demo):

1. Abra um terminal nesta pasta e execute um servidor HTTP local (recomendado para evitar restrições de `localStorage`/`BroadcastChannel` em `file://`):
   ```powershell
   python -m http.server 8765
   ```
2. Aceda no browser a:
   - **Estúdio Split-Screen (Telemóvel + Telão lado a lado):** `http://localhost:8765/preview/index.html`
   - **Mobile Quiz:** `http://localhost:8765/preview/quiz.html`
   - **Mobile Voting:** `http://localhost:8765/preview/vote.html`
   - **Ecrã 16:9 do Auditório:** `http://localhost:8765/preview/live.html`
   - **Painel de Controlo Admin:** `http://localhost:8765/preview/admin.html`

> **Dica na demonstração:** No `preview/index.html`, use o botão **"Novo Colaborador (Simular)"** para testar vários participantes a submeter o Quiz (recebendo o identificador único `TEPA-XXXXXX` e o Voucher Café Bonjour para os 10 primeiros) e a votar na Votação Final enquanto o gráfico do telão actualiza ao vivo.

---

## 3. Configuração do Supabase (Já Ligado & Provisionado)

A base de dados do projecto Supabase **`ujpzqulgainzxxombrgb`** (`https://ujpzqulgainzxxombrgb.supabase.co`) já se encontra provisionada com [`supabase/schema.sql`](./supabase/schema.sql) e **pré-ligada** quer em [`tepa-award-theme.zip`](./tepa-award-theme.zip) quer em [`preview/config.js`](./preview/config.js):
- `tepa_settings` (estado aberto/fechado do Quiz e Votação, modo do palco 16:9 e controlo não-destrutivo por rondas `quiz_epoch` / `vote_epoch`);
- `tepa_projects` (15 categorias/projectos finalistas pré-carregados e editáveis no painel);
- `tepa_questions` + view pública `tepa_public_questions` (`security_invoker = true`, sem expor `correct_answer` ao browser);
- `tepa_quiz_submissions` & `tepa_quiz_feed` (registo com *advisory lock* para atribuir exactamente os **10 primeiros vouchers Café Bonjour** e gerar o código único `TEPA-XXXXXX`);
- `tepa_votes` (bloqueio estrito de **1 voto único por dispositivo** por ronda, código de recibo `VOTE-XXXXXX`);
- Publicação **Supabase Realtime** activa em `tepa_votes`, `tepa_quiz_feed`, `tepa_settings` e `tepa_projects`.
- **PIN de Administrador padrão:** `2026` (pode ser alterado via RPC `change_pin`).
- **Modo Demo Offline:** Pode sempre testar sem gravar no Supabase acrescentando `?demo=1` a qualquer URL do `preview/` ou activando **Force Demo Mode** no WP-Admin.

---

## 4. Instalação no WordPress

1. No painel do WordPress, aceda a **Aparência → Temas → Adicionar Novo → Carregar Tema**.
2. Seleccione [`tepa-award-theme.zip`](./tepa-award-theme.zip), instale e clique em **Activar**.
   - Ao activar, o tema cria automaticamente as páginas `/quiz`, `/vote` e `/live` (e também responde por `/?view=quiz`, `/?view=vote` e `/?view=live` caso os *Permalinks* ainda não estejam configurados).
   - A ligação ao Supabase já fica **activa imediatamente** sem precisar de colar chaves manualmente.
3. No menu lateral do WP-Admin, entre em **TEPA Award 2026** para editar os 15 projectos reais do evento, rever as perguntas do Quiz, exportar a lista dos 10 vencedores em CSV e descarregar/projectar os QR Codes no auditório.

---

## 5. Checklist Antes do Evento (08/12/2026)

1. Actualizar no painel Admin os nomes reais dos **15 projectos finalistas** e as **perguntas oficiais do Quiz**.
2. Fazer o ensaio técnico com a equipa no auditório.
3. Antes da entrada da plateia, clicar em **"Reset All Event Data (Go Live Clean)"** no painel Admin para limpar os votos e respostas de ensaio.
4. No início do evento, activar no painel **Stage Mode → Show Welcome Quiz QR**; na fase de votação final, mudar para **Show Live Voting Bars + QR**; no anúncio final, clicar em **Reveal Best of the Best Winner**.
