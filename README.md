# Jogo Multiplayer Online - Teste de Turing onde todos os jogadores devem se comportarem como uma IA.

## Descrição
Um jogo multiplayer baseado no Teste de Turing, onde jogadores tentam identificar quem é a IA.

# Jogo de Adivinhação com IA

## Objetivo
O objetivo do jogo é ser o primeiro a atingir 20 pontos.

## Regras
- Cada vez que alguém escolhe a sua resposta, você ganha 1 ponto.
- Sempre que acertar qual era a resposta da IA, você ganha 3 pontos.
- Se ninguém acertar qual é a resposta da IA, a IA ganha 3 pontos.

## Como Jogar
1. Cada participante deve registrar-se no jogo informando seu nome.
2. O sistema selecionará aleatoriamente um jogador para iniciar a primeira rodada.
3. O jogador escolhido deve formular uma pergunta para todos responderem.
4. Todos os jogadores, incluindo a IA, devem responder à pergunta proposta.
5. O sistema exibirá todas as respostas (dos jogadores e da IA) de forma anônima.
6. Cada jogador deve tentar identificar qual resposta foi dada pela IA.
7. Após todos votarem, o jogo revelará quem votou em cada resposta.
8. A pontuação será calculada e distribuída conforme as regras estabelecidas.
9. Antes de iniciar uma nova rodada, todos os jogadores devem confirmar que estão prontos.
10. Na rodada seguinte, o jogador à direita de quem iniciou a rodada anterior será o responsável por fazer a nova pergunta.
11. O primeiro jogador a acumular 20 pontos será declarado vencedor.

## Requisitos
- Número mínimo de jogadores: 2
- Número máximo de jogadores: 6

## Instalação e Execução

### Pré-requisitos
- Node.js (v14 ou superior)
- npm (v6 ou superior)

### Passos para Execução

1. Clone o repositório:
   ```
   git clone [URL_DO_REPOSITÓRIO]
   cd [NOME_DA_PASTA]
   ```

2. Instale as dependências:
   ```
   npm install express socket.io dotenv @google/generative-ai
   ```

3. Inicie o servidor:
   ```
   node server.js
   ```

4. Abra o navegador e acesse:
   ```
   http://localhost:3000
   ```

## Tecnologias Utilizadas

- HTML5, CSS3, JavaScript
- Node.js
- Express
- Socket.io
- Web Speech API (para chat de voz)

## Estrutura do Projeto

- `index.html` - Interface do usuário
- `styles.css` - Estilos da aplicação
- `game.js` - Lógica do cliente
- `server.js` - Servidor e lógica do jogo

## Próximos Passos

- Implementação completa do chat de voz
- Sistema de salas para múltiplas partidas simultâneas
- Melhorias na IA para respostas mais convincentes
- Sistema de pontuação e ranking

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.

## Configuração da API do Google Gemini

Este jogo utiliza a API do Google Gemini para gerar respostas de IA. Para configurar:

1. Obtenha uma chave de API no [Google AI Studio](https://makersuite.google.com/)
2. Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:
   ```
   GEMINI_API_KEY=sua_chave_api_aqui
   ```
3. Instale as dependências adicionais:
   ```
   npm install dotenv @google/generative-ai
   ```

**IMPORTANTE**: Nunca compartilhe sua chave de API ou inclua o arquivo `.env` em repositórios públicos. 
