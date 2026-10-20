# Sprites propios de los agentes

Suelta aqui tus sprites y apareceran en la aplicacion. Los 20 agentes ya tienen una hoja
LPC generada desde la libreria oficial; los procedurales siguen existiendo como respaldo:
si un agente no tiene PNG, se dibuja el de siempre.

## Dos formas de nombre

| Fichero | Que es |
| --- | --- |
| `agt-020.png` | PNG **ya recortado** (24x32 recomendado, o cualquier tamano). Se usa tal cual |
| `agt-020@lpc.png` | **Hoja de LPC** (celdas de 64x64). El navegador recorta la celda indicada |

Los ids estan en `GET /api/v1/agents` o en la seccion **Agentes** del CMS.

## PNG recortado

- **24x32 px** recomendado (32x32 u otras alturas valen: se alinea por los pies).
- PNG con transparencia, escala 1x, sin antialias, personaje centrado y con los pies abajo.
- Nombre: `agt-020.png`.

```powershell
npm --prefix frontend run sprites:sync
```

## Hojas de LPC (Universal LPC Spritesheet Generator)

1. Genera el personaje en el generador y descarga la hoja PNG.
2. Guardala aqui como `agt-020@lpc.png`.
3. Regenera el manifiesto:

   ```powershell
   npm --prefix frontend run sprites:sync
   ```

   Eso escribe una entrada como:

   ```json
   "agt-020": { "src": "assets/agents/agt-020@lpc.png", "cell": 64, "row": 2, "frames": 9, "fps": 8 }
   ```

   - `row` es la fila de **caminar hacia abajo**. De ahí se derivan las cuatro direcciones
     siguiendo el orden de LPC: arriba = `row-2`, izquierda = `row-1`, derecha = `row+1`.
     El valor depende de la hoja: una hoja completa tiene 54 filas y `row` es **10**; una
     hoja recortada de caminar tiene 4 filas y `row` es **2**. `sprites:sync` lo deduce del
     alto del PNG. Si el layout no es ese, puedes fijarlas con
     `"rows": { "up": 0, "left": 1, "down": 2, "right": 3 }`.
   - `frames` es el numero de columnas del ciclo (`walk` de LPC usa 9).
   - `fps` es la cadencia de la animacion (8 va bien).

4. **Comprueba la celda.** Abre en el navegador:
   `http://localhost:4200/assets/agents/preview.html`
   Carga la hoja y pasa el raton: veras la rejilla de 64x64 y, abajo, el `row` y el `frame`
   de la celda. En la hoja completa de LPC, `row: 10` es la pose de caminar hacia abajo,
   pero **depende de que animaciones elegiste al generar**: si sale vacia o con otra pose,
   pon los valores que te diga el inspector.
5. Edita `manifest.json` con esos valores y recarga la aplicacion. `sprites:sync` **conserva**
   el descriptor mientras siga apuntando al mismo fichero, asi que tus ajustes no se pierden.

### Componer una hoja a color sin depender del export

A veces el generador exporta la hoja con las capas **sin recolorear** (todo en la paleta
base, en grises o tonos claros) aunque la previsualizacion se vea a color. El recolor del
generador se hace en el navegador leyendo pixeles; si esa lectura falla, devuelve la capa
original y la hoja sale sin color. Se reconoce porque el PNG tiene **0 pixeles con croma**.

Para ese caso existe un compositor propio:

```powershell
npm --prefix frontend run sprites:compose
```

Descarga las capas de caminar del repositorio oficial de LPC, sustituye cada color base
por el color elegido y escribe `agt-020@lpc.png` como una hoja de **9 fotogramas x 4
filas** (arriba, izquierda, abajo, derecha). Los colores usados son los de este personaje:
piel oliva, pantalon marron, mangas y cardigan amarillos, zapatos granate y rastas
naranjas. Si cambias de personaje, edita `LAYERS` y `PALETTES` en
`frontend/tools/compose-lpc-sprite.mjs`; las paletas estan en `palette_definitions/` del
repositorio de LPC.

Despues, como siempre, `npm --prefix frontend run sprites:sync`. La atribucion de las capas
y sus licencias esta en [CREDITS.md](CREDITS.md).

### La plantilla de los 20 agentes

```powershell
npm --prefix frontend run sprites:lineup
```

Genera las 19 hojas que faltan (`agt-001` a `agt-019`) a partir del avatar que ya define
el backend, y escribe una lamina de revision en `frontend/agents-lineup.png`. `agt-020`
(Yanca) no se toca: tiene su propio personaje en `sprites:compose`.

| Avatar del backend | Pieza de LPC |
| --- | --- |
| `body: a` / `b` | cuerpo masculino |
| `body: c` / `d` | cuerpo musculoso |
| `hair: dark / brown / gray / violet / blond / red` | estilo (corto, ondulado, largo o recogido) y color de pelo |
| `skin: light / medium / dark / deep` | paleta de piel (clara, oliva, marron, negra) |
| `palette` (departamento) | color de la camisa |
| `accessory: glasses` | gafas |
| `accessory: headset` / `tablet` | se omiten: LPC no tiene esas piezas |

Los estilos de pelo y las capas concretas estan en `frontend/tools/compose-agent-lineup.mjs`.
Despues de generarlas, `npm --prefix frontend run sprites:sync` actualiza el manifiesto.

### Como se integra la celda

El navegador recorta la celda, elimina el margen transparente y deja al personaje apoyado
abajo. La escala es **entera**: las celdas LPC recortadas (unos 56 px de alto) se dibujan a
1x y los sprites pequenos (24x32) a 2x. Asi no se emborronan los pixeles.

Los fotogramas de una misma direccion se recortan con **una caja comun**: si cada frame se
recortara por separado, el personaje temblaria al alternarlos.

### Paseo de los agentes

Si el sprite tiene `frames` mayor que 1, el agente **pasea** por su sala cuando esta
inactivo: se levanta, recorre el pasillo hasta la zona de descanso, se queda unos segundos y
vuelve a su puesto. Los que estan trabajando se quedan sentados, y si reciben una tarea a
mitad de paseo vuelven a su sitio.

Los agentes **sin** sprite animado (procedurales o PNG estatico) no se mueven: quedarse
quietos es mejor que deslizarse sin animacion.

## Licencias de LPC: importante

Los assets del **Liberated Pixel Cup** son **CC-BY-SA 3.0** (algunos, GPL 3.0). Eso implica:

- **Atribucion obligatoria**: hay que acreditar a los autores de los sprites y al generador
  (el propio generador produce un fichero de creditos; guardalo).
- **Compartir igual**: si publicas el juego/aplicacion con esos sprites, las obras derivadas
  de los sprites deben distribuirse con la misma licencia.

La atribucion concreta de las capas que usa este proyecto (autores, licencias y fuentes)
esta en [CREDITS.md](CREDITS.md).

Si necesitas evitar esas obligaciones, **Kenney** (kenney.nl) es **CC0**. Comprueba siempre
la licencia del pack antes de publicar.
