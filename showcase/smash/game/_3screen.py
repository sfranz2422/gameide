# script: screen
# Words on the screen.
INK, SHADOW, GOLD, RED, MINT = "#ffffff", "#27344a", "#ffd23f", "#ff5a4f", "#9ff0c0"


def text(x, y, words, colour=INK, size=16, align="left"):
    draw_set_font(None, size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def stars_text(n):
    return "*" * n + "." * (3 - n)
