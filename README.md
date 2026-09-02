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
2. A Lia recebe a pergunta e valida a entrada.
3. Se a pessoa pedir para falar com o professor, uma regra em código ativa o
   handoff e bloqueia novas mensagens.
4. Caso contrário, o sistema procura o assunto na FAQ da oficina.
5. Quando encontra uma FAQ, o Gemini responde usando somente esse conteúdo, o
   objetivo escolhido e o histórico da conversa.
6. Quando não encontra uma FAQ, a Lia usa um fallback fixo e oferece o handoff.
7. Perguntas de continuação podem reutilizar a última FAQ, demonstrando memória
   durante a sessão atual.

As decisões críticas são determinísticas. O LLM conversa, mas não decide quando
usar fallback ou handoff.

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
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- Google Gemini com o alias `gemini-flash-latest`
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

- Node.js compatível com o Next.js 16;
- uma chave válida da API do Google Gemini.

### Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env.local` na raiz do projeto:

   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=sua_chave_aqui
   ```

3. Inicie o ambiente local:

   ```bash
   npm run dev
   ```

4. Abra [http://localhost:3000](http://localhost:3000).

Não publique o arquivo `.env.local` nem a chave da API.

## Testes

Execute a suíte automatizada:

```bash
npm test
```

Execute também as verificações do projeto:

```bash
npm run lint
npm run build
```

Os testes cobrem normalização com acentos, precedência do handoff, recuperação
das FAQs, desempate determinístico, fallback, continuação contextual, validação
das mensagens e tratamento seguro de erros do provedor.

## Roteiro sugerido para a demonstração

1. Escolha **Memória + estado** como objetivo.
2. Pergunte “O que é um slot?”.
3. Continue com “E como isso aparece neste bot?”.
4. Faça uma pergunta fora do conteúdo da oficina para mostrar o fallback.
5. Peça para falar com o professor para mostrar o handoff.
6. Reinicie a conversa e confirme que o estado foi limpo.

## Métricas futuras

Uma próxima versão pode acompanhar:

- percentual de perguntas com FAQ encontrada;
- frequência de fallback;
- frequência de handoff;
- resolução sem ajuda humana;
- média de turnos por conversa.

## Limites do MVP

O projeto não inclui autenticação, persistência após recarregar a página,
embeddings, banco vetorial, ferramentas, múltiplos agentes, analytics externo ou
deploy público. O handoff é apenas uma simulação para a demonstração e não envia
mensagens ao professor.
