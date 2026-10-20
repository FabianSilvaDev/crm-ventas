# Créditos de los sprites LPC

Los 20 ficheros `agt-xxx@lpc.png` no son dibujos originales: son **obras derivadas** de
los assets del **Liberated Pixel Cup**, compuestas con capas del repositorio oficial y
recoloreadas con las paletas del proyecto. Hay que mantener esta atribución mientras se
distribuyan con la aplicación.

- `agt-020@lpc.png` (Yanca) se genera con `npm --prefix frontend run sprites:compose`.
- Las otras 19 hojas se generan con `npm --prefix frontend run sprites:lineup`.

Ambos comandos descargan las capas del repositorio oficial y aplican las paletas. Si
cambias las capas o los colores, actualiza esta lista.

## Capas usadas

| Capa | Fichero de origen | Autores | Licencias |
| --- | --- | --- | --- |
| Cuerpo masculino | `body/bodies/male` | bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Cabeza humana masculina | `head/heads/human/male` | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Cara neutra | `head/faces` | JaidynReiman, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0 |
| Cara neutra (masculina) | `head/faces/male/neutral` | JaidynReiman, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Pantalón con dobladillo | `legs/cuffed/male` | JaidynReiman, ElizaWy, Bluecarrot16, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, GPL 3.0 |
| Pantalón con dobladillo (base) | `legs/cuffed` | ElizaWy, JaidynReiman, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0 |
| Mangas largas originales | `torso/clothes/longsleeve/longsleeves/male` | JaidynReiman, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Cárdigan | `torso/clothes/longsleeve/longsleeve2_cardigan` | ElizaWy, JaidynReiman, Stephen Challener (Redshrike), Johannes Sjölund (wulax) | OGA-BY 3.0 |
| Zapatos revisados | `feet/shoes/revised/male` | JaidynReiman, ElizaWy, Bluecarrot16, Stephen Challener (Redshrike), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0 |
| Zapatos revisados (base) | `feet/shoes/revised` | ElizaWy, JaidynReiman | OGA-BY 3.0 |
| Rastas cortas | `hair/dreadlocks_short` | ElizaWy, bluecarrot16 | CC0 |

## Plantilla de los 19 agentes restantes

| Capa | Fichero de origen | Autores | Licencias |
| --- | --- | --- | --- |
| Camisa de manga larga (base) | `torso/clothes/longsleeve/longsleeve/male` | JaidynReiman, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Pantalón | `legs/pants/male` | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| Pantalón formal | `legs/formal` | bluecarrot16, JaidynReiman, ElizaWy, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Pelo corto (Plain) | `hair/plain` | JaidynReiman, Manuel Riecke (MrBeast), Joe White | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| Pelo ondulado (Wavy, bg + fg) | `hair/wavy` | JaidynReiman, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| Pelo largo (Long) | `hair/long` | JaidynReiman, Manuel Riecke (MrBeast) | CC-BY-SA 3.0, GPL 3.0 |
| Recogido corto (Short Topknot) | `hair/parted_side_bangs` y `hair/extensions/ponytails/topknot_short` | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, CC-BY-SA 3.0, GPL 3.0 |
| Gafas | `facial/glasses/glasses` | ElizaWy | OGA-BY 3.0 |

El cuerpo, la cabeza y la cara neutra son los mismos de la tabla anterior, y las paletas
de piel, tela y pelo son las mismas definiciones de `palette_definitions/`.

## Paletas

Los colores destino salen de las definiciones del propio generador:

- piel **oliva**: `palette_definitions/body/body_ulpc.json`
- tela **marrón**, **amarilla** y **granate**: `palette_definitions/cloth/cloth_ulpc.json`
- pelo **naranja**: `palette_definitions/hair/hair_ulpc.json`
- ojos **azules**: `palette_definitions/eye/eye_ulpc.json`

## Fuentes

- Generador: [Universal LPC Spritesheet Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)
  (GPL-3.0). Su `CREDITS.csv` es la lista completa de autores.
- Repositorio: <https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator>

## Obligaciones al publicar

- **Atribución**: hay que acreditar a los autores de la tabla y al generador.
- **Compartir igual**: las capas con CC-BY-SA 3.0 obligan a distribuir la obra derivada
  con la misma licencia. Las de GPL 3.0, bajo GPL 3.0. Las de OGA-BY 3.0 permiten la
  atribución sin copyleft. Las CC0 no imponen condiciones.
- Si el proyecto se publica, conserva este fichero junto a los sprites.
