"""Disegna le icone dell'app (cartellina con la spunta) in public/icone/.
Uso: python3 scripts/icone.py   — serve Pillow (pip install pillow).
"""
from pathlib import Path
from PIL import Image, ImageDraw

BLU = (28, 63, 94, 255)
BIANCO = (255, 255, 255, 255)
VERDE = (46, 122, 79, 255)
GRIGIO = (201, 210, 219, 255)
FERMAGLIO = (185, 194, 203, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icone"
G = 1024  # si disegna grande e si rimpicciolisce: bordi puliti


def cartellina(d, scala=1.0, cx=G / 2, cy=G / 2, colore_carta=BIANCO, colore_spunta=VERDE, righe=True):
    w, h = 520 * scala, 640 * scala
    x0, y0 = cx - w / 2, cy - h / 2 + 30 * scala
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=56 * scala, fill=colore_carta)
    # fermaglio
    fw, fh = 250 * scala, 110 * scala
    d.rounded_rectangle([cx - fw / 2, y0 - fh / 2, cx + fw / 2, y0 + fh / 2], radius=34 * scala,
                        fill=FERMAGLIO if colore_carta == BIANCO else colore_carta)
    if righe:
        for i in range(3):
            yy = y0 + h * 0.62 + i * 62 * scala
            d.rounded_rectangle([x0 + 90 * scala, yy, x0 + w - 90 * scala, yy + 26 * scala], radius=13 * scala, fill=GRIGIO)
    # spunta
    p = [(cx - 150 * scala, y0 + 250 * scala), (cx - 40 * scala, y0 + 355 * scala), (cx + 165 * scala, y0 + 150 * scala)]
    d.line(p, fill=colore_spunta, width=int(70 * scala), joint="curve")
    for x, y in (p[0], p[2]):
        r = 35 * scala
        d.ellipse([x - r, y - r, x + r, y + r], fill=colore_spunta)


def icona(sfondo_pieno=False, scala=1.0, arrotonda=True):
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if sfondo_pieno or not arrotonda:
        d.rectangle([0, 0, G, G], fill=BLU)
    else:
        d.rounded_rectangle([0, 0, G - 1, G - 1], radius=220, fill=BLU)
    cartellina(d, scala)
    return img


def badge():
    """Icona piccola della barra di stato Android: solo sagoma bianca su trasparente."""
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cartellina(d, 1.25, colore_carta=BIANCO, colore_spunta=(0, 0, 0, 0), righe=False)
    return img


def salva(img, nome, lato):
    img.resize((lato, lato), Image.LANCZOS).save(OUT / nome, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    salva(icona(), "icona-512.png", 512)
    salva(icona(), "icona-192.png", 192)
    salva(icona(sfondo_pieno=True, scala=0.78), "icona-maskable-512.png", 512)   # tutto dentro la zona sicura
    salva(icona(arrotonda=False, scala=0.9).convert("RGB"), "apple-touch-icon.png", 180)
    salva(badge(), "badge-96.png", 96)
    print("icone scritte in", OUT)
