# Jogo Multiplayer Online - Teste de Turing com Sabotador

Um jogo multiplayer baseado no Teste de Turing, onde jogadores tentam identificar quem é a IA e quem é o sabotador.

## Descrição

Neste jogo, 3-6 jogadores participam de uma partida onde:
- Cada jogador recebe um código aleatório (P1, P2, P3...)
- Um jogador é secretamente designado como sabotador
- Uma IA também participa, se passando por um jogador

O objetivo dos jogadores é descobrir quem é a IA, enquanto o sabotador tenta identificar a identidade real de um dos jogadores.

## Como Jogar

1. **Fase de Pergunta**: Todos discutem qual pergunta será feita para identificar a IA
2. **Fase de Resposta**: Um jogador aleatório e a IA respondem à pergunta
3. **Fase de Votação**: Jogadores votam em qual resposta pertence à IA
4. **Resultado Parcial**: O jogo exibe a porcentagem de votos
5. **Discussão & Decisão**: Jogadores debatem se querem identificar a IA ou seguir para a próxima rodada
6. **Sabotagem Oculta**: O sabotador pode tentar identificar um jogador real

## Condições de Vitória

- **Jogadores**: Descobrir corretamente quem é a IA dentro de três rodadas
- **IA e Sabotador**: Não serem descobertos até o fim da terceira rodada
- **Sabotador**: Identificar corretamente a identidade real de um jogador

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