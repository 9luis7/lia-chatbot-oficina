# Lia — assistente da oficina de chatbots

A Lia é um chatbot educacional criado como projeto prático para uma oficina de
chatbots baseados em LLM. Ela ajuda participantes a entender os principais
conceitos da aula, mantém o contexto da conversa e mostra, de forma visual, as
decisões tomadas durante cada interação.

O projeto foi pensado como um MVP local: pequeno o bastante para uma
demonstração em sala, mas com separação clara entre regras de negócio e geração
de texto pelo modelo.

## Fluxo da conversa

1. A pessoa escolhe um objetivo de aprendizagem, como design conversacional,
   system prompt, memória, guardrails ou base de conhecimento.
2. A Lia recebe a pergunta e valida a entrada (incluindo o limite de 500
   caracteres).
3. Se a pessoa pedir para falar com o professor, uma regra em código ativa o
   handoff e bloqueia novas mensagens.
4. Caso contrário, o sistema procura o assunto na FAQ da oficina (uma
   recuperação local, anterior a RAG).
5. Quando encontra uma FAQ, e somente nesse caso, o Gemini responde usando
   somente esse conteúdo, o objetivo escolhido e o histórico da conversa.
6. Quando não encontra uma FAQ, a Lia usa um fallback fixo e seguro e oferece o
   handoff. Erros do provedor também recebem uma resposta segura.
7. Perguntas de continuação podem reutilizar a última FAQ, demonstrando memória
   durante a sessão atual.

As decisões críticas são determinísticas, nesta ordem: **validação → handoff →
FAQ → Gemini → fallback**. O LLM conversa, mas não decide quando usar fallback
ou handoff; o Gemini é chamado apenas quando há uma FAQ correspondente.

## Checklist do MVP

- Persona e regras definidas no system prompt.
- Um slot de estado para o objetivo de aprendizagem.
- Memória durante a sessão atual do navegador.
- Guardrail e handoff simulando ajuda do professor.
- Base de conhecimento com sete FAQs da aula.
- Respostas do modelo transmitidas por streaming.
- Painel para acompanhar rota, FAQ, memória, modelo e número de turnos.

## Tecnologias

- Next.js com App Router
- React
- TypeScript
- Tailwind CSS
- AI SDK 7 e `@ai-sdk/google`
- Google Gemini com o alias `gemini-flash-latest` (um alias que pode ser
  atualizado pelo Google)
- Vitest e Testing Library

## Base de conhecimento

A FAQ cobre sete assuntos apresentados na oficina:

- checklist mínimo de um bom bot;
- happy path;
- slot e estado;
- diferença entre regras e LLM;
- base de conhecimento;
- testes e preparação da demonstração;
- métricas para evoluções futuras.

A recuperação usa normalização de texto e palavras-chave. Não há embeddings,
banco vetorial ou banco de dados neste MVP.

## Como executar

### Requisitos

- Node.js 24 (recomendado e a versão atual deste workspace);
- uma chave válida da API do Google Gemini.

### Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o exemplo para criar o arquivo `.env.local` na raiz do projeto:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Abra `.env.local` e preencha `GOOGLE_GENERATIVE_AI_API_KEY` com a sua chave
   do Gemini.

4. Inicie o ambiente local:

   ```bash
   npm run dev
   ```

5. Abra [http://localhost:3000](http://localhost:3000).

Não publique o arquivo `.env.local` nem a chave da API. O arquivo
`.env.example` contém somente o nome da variável, sem valor real.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run dev` | inicia o ambiente local de desenvolvimento |
| `npm test` | executa a suíte Vitest uma vez |
| `npm run test:watch` | executa o Vitest em modo observação |
| `npm run lint` | verifica regras de lint |
| `npm run typecheck` | gera tipos de rotas do Next e verifica TypeScript |
| `npm run build` | gera o build de produção |
| `npm run start` | inicia o build de produção |

## Testes e segurança

Os testes cobrem normalização com acentos, precedência do handoff, recuperação
das FAQs, desempate determinístico, fallback, continuação contextual, validação
das mensagens e tratamento seguro de erros do provedor.

A memória é exclusiva da sessão atual do navegador: ela ajuda a interpretar
continuações, mas some ao recarregar ou reiniciar a conversa. O handoff é uma
simulação determinística para a aula, não um contato real com o professor.

## Roteiro sugerido para a demonstração

1. Escolha **Memória + estado** como objetivo.
2. Pergunte “O que é um slot?”.
3. Continue com “E como isso aparece neste bot?”.
4. Faça uma pergunta fora do conteúdo da oficina para mostrar o fallback.
5. Use **Falar com o professor**.
6. Reinicie a conversa e confirme que o estado foi limpo.

## Métricas futuras

Uma próxima versão pode acompanhar:

- FAQ-hit;
- fallback;
- handoff;
- resolução;
- média de turnos por conversa.

Não há analytics externo instalado neste MVP.

## Limites do MVP

O projeto não inclui autenticação, banco de dados, persistência após recarregar
a página, embeddings ou banco vetorial, agentes em runtime, analytics externo ou
deploy público. O handoff é apenas uma simulação para a demonstração e não envia
mensagens ao professor.

## Deploy opcional

A Vercel CLI não é necessária para rodar localmente. Caso queira preparar um
fluxo de deploy depois, `npm i -g vercel` libera `vercel env pull`, `vercel
deploy` e `vercel logs`.
