# Shahid TV (módulo TizenBrew)

Abre o shahid.mbc.net na Samsung como se fosse app, com o login salvo e o controle remoto funcionando. É um módulo do [TizenBrew](https://github.com/reisxd/TizenBrew), que roda o site e injeta `dist/userScript.js` nele.

Testado no Chrome do Mac em 22/11/2026 (navegação por setas nas linhas, carrossel, abrir card, voltar). O player não deu pra testar fora da TV: no navegador do Mac, sem login, ele mostra erro. Na TV da família o vídeo já tocou pelo navegador da própria TV.

## Controles

- Setas: andam entre cards, menus e botões (contorno verde mostra onde está).
- OK: abre. Voltar: volta uma página; na home, fecha.
- No player: esquerda/direita = -10s/+10s (segurando acelera), OK ou play/pause = pausa, avançar/retroceder = ±30s.
- No player, cima/baixo entram nos botões do player (episódios, legenda). Voltar sai desse modo.
- Vermelho ou 0: liga/desliga um cursor de mouse, pra qualquer tela que a navegação não alcance.
- Aviso de privacidade do site aparece na primeira vez: o foco fica preso no "حسناً" até apertar OK.

## Instalar na TV

1. **Modo desenvolvedor.** Na TV: Apps, digita `12345` no controle, liga Developer mode e coloca o IP do Mac em Host PC IP (hoje é `192.168.15.11`). Desliga a TV segurando o botão power até reiniciar.
2. **TizenBrew.** No Mac, roda o TizenBrew Installer Desktop (github.com/reisxd/TizenBrewInstaller, releases) e clica em Install TizenBrew. Como a Q70D é Tizen 8, ele pede login na conta Samsung pra gerar o certificado da TV.
3. **Host PC IP = 127.0.0.1.** Volta no Apps > `12345` e troca o IP pra `127.0.0.1`, reinicia de novo. O TizenBrew precisa disso pra conseguir injetar o script.
4. **Módulo.** Abre o TizenBrew, Module Manager > Add module e digita o nome do módulo publicado (`gh/<usuario>/shahid-tv` se for GitHub, ou `npm/shahid-tv-tizen` se for npm).
5. Abre "Shahid TV", faz login uma vez. Os cookies ficam no TizenBrew.

## Publicar uma versão nova

O TizenBrew baixa o módulo pelo jsDelivr, que espelha GitHub e npm. Depois de mudar o script, sobe pro repositório e cria uma tag nova (o jsDelivr segura cache da branch por até 12h; com tag é na hora): `gh/<usuario>/shahid-tv@1.0.1`.

Arquivos que precisam estar no repositório: `package.json` e `dist/userScript.js`.
