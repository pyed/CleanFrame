"""Build the exact private-font overlay used by preview and local packaging.

Pangram and Thmanyah binaries remain in ignored .local/ storage. A public
checkout ships Manrope, Geist, Newsreader and IBM Plex Sans Arabic. Complete
local pairs are added directly to the widget ZIP; they are never copied into app/.
"""
from pathlib import Path
import json
import re
import zipfile
from local_config import override_identity
from private_files import check_widget, private_path, secret_content

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FONT_IDS = ['geist', 'newsreader']
PRIVATE_FONTS = [
    {
        'id': 'montreal', 'family': 'Study Montreal', 'folder': 'neue-montreal',
        'files': [('PPNeueMontreal-Light.ttf', 300), ('PPNeueMontreal-Regular.ttf', 400)],
        'metrics': 'size-adjust:100.699301%;ascent-override:105.859722%;descent-override:29.791667%;line-gap-override:0%',
    },
    {
        'id': 'mori', 'family': 'Study Mori', 'folder': 'mori',
        'files': [('PPMori-Extralight.ttf', 200), ('PPMori-Regular.ttf', 400)],
        'metrics': 'size-adjust:102.857143%;ascent-override:103.638889%;descent-override:29.166667%;line-gap-override:0%',
    },
    {
        'id': 'pangram', 'family': 'Study Pangram', 'folder': 'pangram-sans',
        'files': [('PPPangramSans-Light.ttf', 300), ('PPPangramSans-Regular.ttf', 400)],
        'metrics': 'size-adjust:101.408451%;ascent-override:105.119444%;descent-override:29.583333%;line-gap-override:0%',
    },
    # Thmanyah's licence forbids redistribution: each owner downloads the files from
    # font.thmanyah.com. Names without an extension accept the .otf, .ttf or web formats.
    {
        'id': 'thmanyah', 'family': 'Study Thmanyah', 'folder': 'thmanyah',
        'files': [('thmanyahsans-Regular', 400), ('thmanyahsans-Medium', 500)],
        'metrics': '',
    },
    {
        'id': 'thmanyahserif', 'family': 'Study Thmanyah Serif', 'folder': 'thmanyah',
        'files': [('thmanyahserifdisplay-Regular', 400), ('thmanyahserifdisplay-Medium', 500)],
        'metrics': '',
    },
]
FONT_FORMATS = {'.otf': 'opentype', '.ttf': 'truetype', '.woff2': 'woff2', '.woff': 'woff'}


def font_file(folder, name):
    """A complete file name, or the first font format present for an extensionless name."""
    if Path(name).suffix.lower() in FONT_FORMATS:
        return folder / name
    for suffix in FONT_FORMATS:
        if (folder / (name + suffix)).is_file():
            return folder / (name + suffix)
    return folder / (name + '.otf')


def is_runtime_source(name):
    """Keep retained rendering tools and legacy layout assets out of the widget."""
    if name in ['grid.css', 'optics.js']:
        return False
    if name.startswith(('assets/grid/', 'assets/vendor/')):
        return False
    return not re.fullmatch(r'assets/wallpapers/[^/]+-glass-\d+\.png', name)


def font_overlay(root=ROOT, include_private=True):
    """Return package-relative paths mapped to bytes or allowlisted font files."""
    sources = (root / '.local/research/font-candidates').resolve()
    assets = {}
    private_ids = []
    css = ['/* Local font overlay. Proprietary binaries are not part of app/. */']
    if include_private:
        for font in PRIVATE_FONTS:
            names = [font_file(sources / font['folder'], name) for name, _ in font['files']]
            files = [path.resolve() for path in names]
            # Exclude incomplete pairs and symlinks that leave the private font folder.
            if not all(path.is_relative_to(sources) and path.is_file() for path in files):
                continue
            private_ids.append(font['id'])
            for (_, weight), name, source in zip(font['files'], names, files):
                relative = font['folder'] + '/' + name.name
                assets['assets/private-fonts/' + relative] = source
                css.append("@font-face{font-family:'" + font['family'] + "';font-style:normal;"
                           'font-weight:' + str(weight) + ";src:url('private-fonts/" + relative + "') format('" + FONT_FORMATS[name.suffix.lower()] + "');"
                           'font-display:block;' + font['metrics'] + '}')
    assets['assets/private-fonts.css'] = ('\n'.join(css) + '\n').encode()
    assets['assets/font-catalog.js'] = ('window.CleanFramePrivateFontIDs = '
                                       + json.dumps(private_ids + PUBLIC_FONT_IDS) + ';\n').encode()
    return assets


def write_widget_archive(output, root=ROOT, include_private=True, identity=None):
    """Create an unsigned archive without reading signing or device settings."""
    app = root / 'app'
    overlay = font_overlay(root, include_private)
    if identity is not None:
        overlay['config.xml'] = override_identity((app / 'config.xml').read_bytes(), identity)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as package:
        for source in sorted(app.rglob('*')):
            if source.is_symlink():
                raise ValueError('Widget assets must be regular files, not symlinks: ' + str(source.relative_to(app)))
            if not source.is_file():
                continue
            name = source.relative_to(app).as_posix()
            if private_path(name) or secret_content(source.read_bytes()):
                raise ValueError('Private material in app source: ' + name)
            if name.startswith('assets/private-fonts/'):
                raise ValueError('Private font binaries must stay in .local/, not app/.')
            if name not in overlay and is_runtime_source(name):
                package.write(source, name)
        for name, source in sorted(overlay.items()):
            if isinstance(source, Path):
                package.write(source, name)
            else:
                package.writestr(name, source)
    check_widget(output)

