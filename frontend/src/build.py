from pathlib import Path

here = Path(__file__).resolve().parent
template = (here / "template.html").read_text()
app = (here / "app.js").read_text()
(here.parent / "index.html").write_text(template.replace("__APP__", app))
print("Built frontend/index.html")
