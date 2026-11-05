# Fiscal Dunas

PWA offline para a fiscalização de veículos em dunas, restingas e margens de lagoa da PATRAM no litoral do RS. Classifica o local, sugere o enquadramento ambiental e de trânsito, indica o rito (TC ou DP), as bases para recolher o veículo e gera os documentos.

Os dados ficam só no aparelho, criptografados com a senha (AES-GCM, chave PBKDF2). Nenhum dado de abordagem ou backup entra neste repositório.

## Uso

1. Criar a senha.
2. **Dados:** nome, Id funcional e fração do agente, endereço de comparecimento, brasão e logo do Comando (as imagens ficam só no aparelho) e os **municípios com convênio de trânsito**. Sem convênio, o app não sugere AIT nem remoção (CTB, art. 23, III).
3. **Nova abordagem**, em sete blocos:
   1. **Local:** via ou fora de via, ambiente (duna frontal, campo de dunas móveis, banhado, restinga...), vegetação fixadora, distância da preamar e da lagoa, UC, terreno de marinha, área privada. O GPS avisa quando o ponto está no corredor eólico dos Lençóis Cidreirenses.
   2. **Veículo:** tipo, placa, chassi, registro. Placa ou chassi já abordados aparecem como histórico (uso reiterado).
   3. **Condutor e proprietário:** qualificação, CNH, quem entregou a direção.
   4. **Dano:** vegetação, estágio, área em m², sulcos, trilha reiterada, toca ou ninho, extração de areia.
   5. **Condutas:** embriaguez, manobras, racha, fuga, evento organizado, reincidência.
   6. **Medidas:** providências com número, apreensão (com a base escolhida, o valor de avaliação e o fiel depositário) e notificação.
   7. **Fatos e documentos:** o texto do histórico é gerado pelo enquadramento e pode ser editado.

   O painel recalcula a cada campo: regras D01 a D27, crime e infração sugeridos, rito pela soma das penas máximas, agravantes e pendências. **O painel indica, não autua.** O Termo de Apreensão só sai com base válida e valor de avaliação (D10 e D14).
4. **Documentos:** Notificação Ambiental, Termo de Apreensão e Fiel Depositário, Auto de Constatação (Dec. RS 55.374/2020, art. 119) e cópia do histórico para o BO/TC. No celular, "Imprimir" permite salvar em PDF.
5. **Guia:** resumo da base legal para consulta sem internet (útil para colegas de reforço).
6. **Backup:** exportar ou enviar para a nuvem; importar em outro aparelho com a senha de origem. As abordagens são mescladas, e vale a edição mais recente.

## Regras

Base legal e regras no documento do projeto ("Fiscal Dunas: base legal e regras do app"). Resumo:

| Regra | O que checa |
| --- | --- |
| D01, D02 | Via ou fora de via; convênio de trânsito |
| D03 | Alteração de duna frontal ou campo de dunas (art. 63, só com laudo) |
| D04 a D06 | APP: restinga até 300 m da preamar, vegetação fixadora, faixa de lagoa |
| D07, D08 | Unidade de Conservação (multa em dobro); bem da União |
| D09 | Rito: até 2 anos somados, TC; acima, DP |
| D10 | Bases da apreensão: penal, administrativa (art. 24) ou trânsito |
| D11 a D15 | Histórico, reincidência, fiel depositário, valor de avaliação, agravantes |
| D16 a D19 | Embriaguez, menor e art. 310, veículo sem placa, toca ou ninho |
| D20 | Sem irregularidade: orientação |
| D21 a D27 | Trilha reiterada (art. 48), Mata Atlântica (art. 38-A), extração de areia, fuga, evento, habilitação, condutas na via |

## Desenvolvimento

- `npm test` roda os testes das regras e dos documentos.
- Servir local: `python3 -m http.server` e abrir http://localhost:8000.
- Ao publicar mudanças, rode `node tools/versao.mjs`: ele sobe a versão do cache em `sw.js`. O teste `test/sw.test.mjs` falha se isso for esquecido.

## Próximas fases

- Fotos georreferenciadas dentro da abordagem (relatório fotográfico).
- Camadas offline: linha de preamar, faixas de lagoa, dunas frontais (FEPAM/GERCO) e limites de UC.
- Normas municipais de trânsito na orla, quando localizadas.
