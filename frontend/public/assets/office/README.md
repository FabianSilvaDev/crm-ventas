# Props y tiles de oficina

Estos PNGs vienen de dos packs de OpenGameArt y se usan como mobiliario, suelos, paredes
y decoracion de las salas de la oficina virtual. No son dibujos originales del proyecto.

## LPC Revised: The Office

- **Obra:** LPC Revised: The Office
- **Autoria:** Eliza Wyatt (Death's Darling). Elementos del escritorio ornamentado y de
  los retratos de oficina usan piezas de Lanea Zimmerman (Sharm).
- **Licencia:** OGA-BY 3.0 (CC-BY 3.0 con renuncia a DRM).
- **Origen:** <https://opengameart.org/content/lpc-revised-the-office>
- **Repositorio del autor:** <https://github.com/ElizaWy/LPC>

La atribucion completa, pieza por pieza, esta en [`Credits.txt`](Credits.txt), que se
distribuye junto a los PNGs.

## Pixel Art Lab/Office Tiles

- **Obra:** Pixel Art Lab/Office Tiles
- **Autor:** The Leafy Lemur
- **Licencia:** CC-BY 3.0 (<https://creativecommons.org/licenses/by/3.0/>)
- **Origen:** <https://opengameart.org/content/pixel-art-lab-office-tiles>
- **Uso:** suelo y pared de cada sala. Son tiles de 32x32 que se repiten; el color final
  lo pone el tinte del departamento.

## Ficheros incluidos

| Fichero | Contenido | Uso en la aplicacion |
| --- | --- | --- |
| `water-cooler.png` | 4 variantes de nevera de agua (32x64 cada una) | zona de descanso de cada sala |
| `coffee-maker.png` | 2 variantes de cafetera (32x32) | salas con `coffee` en su decoracion |
| `copy-machine.png` | fotocopiadora (64x64) | salas con `printer` en su decoracion |
| `bins.png` | 5 colores x 4 vistas de papelera (32x32) | junto a los puestos |
| `office-portraits.png` | 5 retratos (32x32) | pared de cada sala |
| `rotary-phones.png` | 4 colores x 4 vistas de telefono (32x32) | sobre las mesas |
| `laptop.png` | 4 orientaciones x 4 estados de portatil (32x32) | sobre cada mesa |
| `ornate-desk.png` | escritorio de madera con cajones (vista frontal) | puesto de trabajo |
| `lab-office-tiles.png` | hoja original del pack Lab/Office Tiles | fuente de los dos tiles siguientes |
| `floor-tile.png` | baldosa gris de 32x32 (recorte de `lab-office-tiles.png`) | suelo de cada sala |
| `wall-tile.png` | panel de pared de 32x32 (recorte de `lab-office-tiles.png`) | pared de cada sala |

Los recuadros concretos de cada pieza estan en
`frontend/src/app/features/virtual-office/pixel/office-props.ts`. El pack de The Office
tambien trae mesa de cartas, fregadero, television, carrito de compra, buzones, taza de
cafe y la luz animada de la fotocopiadora; no se copiaron porque todavia no se usan.

## Obligaciones

- **The Office (OGA-BY 3.0):** permite uso comercial y modificacion, pero exige
  atribucion (Eliza Wyatt y Lanea Zimmerman) y enlazar el pack. No impone compartir igual.
- **Lab/Office Tiles (CC-BY 3.0):** exige atribucion (The Leafy Lemur) y enlazar la
  licencia y la obra. No impone compartir igual.

Conserva este fichero y `Credits.txt` mientras los PNGs se distribuyan con la aplicacion.
