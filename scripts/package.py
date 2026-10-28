"""Build and sign through an existing official Tizen SDK profile (macOS/Linux; Windows with saved passwords)."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import zipfile

from font_assets import write_widget_archive
from local_config import ROOT, load_settings, read_password
from private_files import check_signed_widget

WINDOWS = os.name == 'nt'
if not WINDOWS:
    import pty
    import select
    import signal
    import termios


def sign(command, password=None, timeout=60):
    # SDK output can include profile credentials. Never copy it to diagnostics.
    pid, terminal = pty.fork()
    if pid == 0:
        try:
            os.execv(command[0], command)
        except BaseException:
            os._exit(127)
    output = b''
    passwords = saves = 0
    status = None
    deadline = time.monotonic() + timeout
    try:
        while time.monotonic() < deadline:
            ready, _, _ = select.select([terminal], [], [], 1)
            if not ready:
                continue
            try:
                chunk = os.read(terminal, 8192)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
            if len(output) > 1024 * 1024:
                raise ValueError('SDK produced excessive signing output.')
            count = output.lower().count(b'password:')
            if count > passwords:
                if password is None:
                    raise ValueError('SDK requested a password. Configure saved profile access or select a protected password file.')
                if count > 2:
                    raise ValueError('SDK requested too many passwords. Check both certificate passwords in the selected profile.')
                attributes = termios.tcgetattr(terminal)
                attributes[3] &= ~termios.ECHO
                termios.tcsetattr(terminal, termios.TCSANOW, attributes)
                os.write(terminal, password + b'\n')
                passwords = count
            count = output.count(b'No: (N) ?')
            if count > saves:
                os.write(terminal, b'n\n')
                saves = count
        else:
            raise ValueError('SDK signing timed out.')
        while time.monotonic() < deadline:
            finished, status = os.waitpid(pid, os.WNOHANG)
            if finished:
                break
            status = None
            time.sleep(0.01)
        if status is None:
            raise ValueError('SDK signing timed out.')
    finally:
        if status is None:
            finished, status = os.waitpid(pid, os.WNOHANG)
            if not finished:
                try:
                    try:
                        os.killpg(pid, signal.SIGKILL)
                    except PermissionError:
                        os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                _, status = os.waitpid(pid, 0)
        os.close(terminal)
    return os.waitstatus_to_exitcode(status)


def sign_windows(command, password=None, timeout=120):
    """Run tizen.bat without a terminal; Windows signing uses only the profile's saved passwords."""
    if password is not None:
        raise ValueError('On Windows, leave password_file null and save the profile passwords in the SDK certificate tools.')
    # cmd.exe runs the .bat and would interpret these characters in a profile name or path.
    if any(char in '&|<>^%"!' for part in command for char in part):
        raise ValueError('On Windows, the profile name and paths cannot contain & | < > ^ % " or !.')
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        output, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(process.pid)], capture_output=True)
        process.communicate()
        raise ValueError('SDK signing timed out.') from None
    # SDK output can include profile credentials: inspect it, never print it.
    if b'password:' in output.lower():
        raise ValueError('SDK requested a password. Save the profile passwords in the SDK certificate tools.')
    return process.returncode


def main(root=ROOT):
    settings = load_settings(root)
    cli = settings['sdk_path'] / ('tools/ide/bin/tizen.bat' if WINDOWS else 'tools/ide/bin/tizen')
    if not cli.is_file() or not os.access(cli, os.X_OK):
        raise ValueError('Tizen CLI missing. Set sdk_path in .local/signing.json; see docs/development.md.')
    if WINDOWS and settings['password_file']:
        raise ValueError('On Windows, leave password_file null and save the profile passwords in the SDK certificate tools.')
    password = read_password(settings['password_file'], root=root) if settings['password_file'] else None
    dist = root / 'dist'
    dist.mkdir(exist_ok=True)
    unsigned = dist / 'CleanFrame-unsigned.wgt'
    write_widget_archive(unsigned, root=root, identity=settings['identity'])
    # A fresh folder prevents a previous signed widget masking a failed build.
    signed_dir = Path(tempfile.mkdtemp(prefix='signed-', dir=dist))
    command = [str(cli), 'package', '-t', 'wgt', '-s', settings['profile'], '-o', str(signed_dir), '--', str(unsigned)]
    if (sign_windows if WINDOWS else sign)(command, password):
        raise ValueError('SDK signing failed. Check the selected profile and password access in Certificate Manager.')
    signed = signed_dir / unsigned.name
    try:
        check_signed_widget(signed, settings['identity'])
    except ValueError as error:
        # An unknown profile name still yields a package, without signatures.
        if str(error) != 'Package is missing its signing files.':
            raise
        raise ValueError('The SDK made an unsigned package: check that profile "' + settings['profile']
                         + '" is in the profiles file shown by tizen cli-config -l (default.profiles.path).') from None
    target = dist / 'CleanFrame.wgt'
    # Promote on the same filesystem so a failed copy preserves the last build.
    ready = signed_dir / 'validated.wgt'
    ready.write_bytes(signed.read_bytes())
    ready.replace(target)
    print('Signed widget created: ' + str(target))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, zipfile.BadZipFile) + (() if WINDOWS else (termios.error,)) as error:
        # Known validation messages contain no credentials. Suppress SDK/OS payloads.
        message = str(error) if isinstance(error, ValueError) else 'Cannot complete packaging. Check SDK/profile setup and local file permissions.'
        raise SystemExit(message) from None
