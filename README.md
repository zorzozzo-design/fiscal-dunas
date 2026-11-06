# Fiscal Dunas

PWA offline da PATRAM para fiscalizar veículos em dunas, restingas e margens de lagoa no litoral do RS. O app classifica o local e sugere o enquadramento ambiental e de trânsito. Também indica o rito (TC ou DP) e as bases para recolher o veículo. Por fim, gera os documentos.

Os dados ficam só no aparelho. A senha criptografa os dados (AES-GCM, chave PBKDF2). Este repositório não tem dados de abordagem nem backup.

Os textos de tela, do painel e do Guia seguem o ASD-STE100, adaptado ao português: frases curtas, uma instrução por frase, imperativo e voz ativa. Os documentos oficiais seguem a linguagem jurídica. O teste `test/ste.test.mjs` confere essa regra.

## Uso

1. Crie a senha.
2. Em **Dados**, preencha o agente: nome, Id funcional, fração e endereço de comparecimento. Carregue o brasão e o logo do Comando. As imagens ficam só no aparelho.
   - **Convênios de trânsito:** todo o RS tem convênio com a BM, e o app parte disso. Marque só o município com convênio vencido ou suspenso. Nesse município, o app não sugere AIT nem remoção (CTB, art. 23, III).
   - **Camadas do mapa:** importe arquivos KML ou GeoJSON de UC, dunas, preamar ou lagoas. Converta shapefile ou KMZ para KML antes.
3. Toque em **Nova abordagem**. Preencha os sete blocos:
   1. **Local:** via ou fora de via, ambiente, vegetação fixadora, distância da preamar e da lagoa, UC, terreno de marinha e área privada. Informe também como mediu a distância da preamar. O GPS mostra se o ponto está no corredor eólico dos Lençóis Cidreirenses. Com camadas importadas, o GPS também mostra a área do ponto e a distância das linhas até 2 km.
   2. **Veículo:** tipo, placa, chassi e registro. Uma placa ou um chassi já abordados aparecem como histórico (uso reiterado).
   3. **Condutor e proprietário:** qualificação, CNH e quem entregou a direção.
   4. **Dano e fotos:** vegetação, estágio, área em m², sulcos, trilha reiterada, toca ou ninho e extração de areia. Tire fotos com a câmera ou escolha da galeria. Escreva uma legenda para cada foto. A hora e as coordenadas vêm do arquivo da foto. Se o arquivo não tem GPS, a foto tirada pelo app recebe o GPS do aparelho. A foto da galeria sem GPS fica sem coordenadas. O app reduz cada foto a 1280 px e guarda a foto à parte, criptografada. A abordagem guarda só a referência da foto.
   5. **Condutas:** embriaguez, manobras, racha, fuga, evento organizado e reincidência.
   6. **Medidas:** providências com número, apreensão e notificação. Na apreensão, escolha a base, informe o valor de avaliação e o fiel depositário.
   7. **Fatos e documentos:** o app gera o texto do histórico pelo enquadramento. Edite o texto se necessário.

   Ao salvar pela primeira vez, a abordagem recebe um número que nunca muda: FD-<Id funcional>-<ano>-<sequência>. Cada documento sai com esse número e o tipo: /N (Notificação), /T (Termo), /A (Auto) e /F (Relatório fotográfico). O app confere CPF, placa e chassi. Um dado fora do padrão vira pendência, que pode ser dispensada.

   O painel recalcula a cada campo: regras D01 a D28, crime e infração sugeridos, rito, agravantes e pendências. **O painel indica, mas não autua.** O Termo de Apreensão só sai com base válida e valor de avaliação (D10 e D14).
4. **Documentos:** Notificação Ambiental, Termo de Apreensão e Fiel Depositário, Auto de Constatação (Dec. RS 55.374/2020, art. 119), Relatório Fotográfico e cópia do histórico para o BO/TC. Com fotos, o Auto e o histórico citam o relatório. Para salvar em PDF, toque em "Imprimir". Em **Formato dos documentos**, escolha **Impressora térmica** para imprimir Notificação, Termo e Auto em uma coluna (bobina de 58 ou 80 mm, definida em Dados): cada campo tem o título numa linha e o conteúdo na linha de baixo. No Android, instale um app de impressão térmica (por exemplo, RawBT). O Relatório fotográfico sai sempre em A4.
5. **Denúncias:** aba ao lado de Abordagens. Registre data, situação, tipo, origem, local e relato. Cole a mensagem do WhatsApp no relato. Anexe fotos e vídeos (vídeo até 50 MB). Para ir ao local, toque em **Nova abordagem desta denúncia**: a abordagem já vem com município, local e placa. A denúncia mostra as abordagens ligadas a ela e as abordagens com a mesma placa. Use a busca para achar uma denúncia por local, placa, pessoa ou relato. O backup leva as denúncias e, se marcado, os anexos.
6. **Relatório:** aba ao lado de Denúncias. Escolha o período e veja abordagens, crimes, notificações, apreensões, denúncias e abordagens por município. Toque em **Baixar planilha (CSV)** para abrir no Excel. A planilha sai sem criptografia: guarde o arquivo em local seguro.
7. **Guia:** resumo da base legal para consulta sem internet.
8. **Backup:** baixe o arquivo ou envie para a nuvem. Para importar em outro aparelho, use a senha do aparelho de origem. O app mescla as abordagens e mantém a edição mais recente. Escolha se o backup leva as fotos.

## Regras

O procedimento na faixa de areia e nas dunas segue a Orientação 002/2ª Cia/1º BPAmb/2025 (29/12/2025): códigos do Talonário no enquadramento, AIT do art. 181, VIII na duna com dano, manobra como crime do art. 308 e AIT pelo art. 193 (o art. 175 só com imagens).

Base legal e regras no documento do projeto ("Fiscal Dunas: base legal e regras do app"). Resumo:

| Regra | O que checa |
| --- | --- |
| D01, D02 | Via ou fora de via; convênio de trânsito |
| D03 | Alteração de duna frontal ou campo de dunas (art. 63, só com laudo) |
| D04 a D06 | APP: restinga (incluídas as dunas) até 300 m da preamar, com aviso se a distância foi estimada; vegetação fixadora; faixa de lagoa |
| D07, D08 | Unidade de Conservação (multa em dobro); bem da União |
| D09 | Rito: até 2 anos somados, TC; acima, DP |
| D10 | Bases da apreensão: penal, administrativa (art. 24) ou trânsito |
| D11 a D15 | Histórico, reincidência, fiel depositário, valor de avaliação, agravantes |
| D16 a D19 | Embriaguez, menor e art. 310, veículo sem placa, toca ou ninho |
| D20 | Sem irregularidade: orientação |
| D21 a D27 | Trilha reiterada (art. 48), Mata Atlântica (art. 38-A), extração de areia, fuga, evento, habilitação, condutas na via |
| D28 | Faixa de areia, pela Orientação 002/2ª Cia/1º BPAmb/2025: transitar com placa, CTB art. 187, I; sem placa, art. 193; estacionar com placa, art. 181, XVII; trechos liberados em Cidreira |

## Desenvolvimento

- `npm test` roda os testes das regras e dos documentos.
- Servir local: `python3 -m http.server` e abrir http://localhost:8000.
- Ao publicar mudanças, rode `node tools/versao.mjs`: ele sobe a versão do cache em `sw.js`. O teste `test/sw.test.mjs` falha se isso for esquecido.

## Próximas fases

- Obter os arquivos oficiais das camadas (FEPAM/GERCO, ICMBio, SEMA) e deixar um pacote pronto do Litoral Norte para importar.
- Leis municipais de orla de Tramandaí, Imbé, Xangri-lá, Arroio do Sal e Balneário Pinhal: não localizadas; hoje vale a Lei RS 9.204/1991.
