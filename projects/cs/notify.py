"""A Windows toast when the CS sync goes wrong (Ric's call, 2026-10-15).

The sync runs under pythonw with no window, so before this a failed push or a
step that fell over only ever reached cs-session.log. A toast sits in the corner
and the Action Center without taking focus from a fullscreen game.

No dependencies: PowerShell's own WinRT bridge raises it, under PowerShell's app
id (Windows refuses toasts from an id it has never seen registered). Anything
that goes wrong here is swallowed — an alert must never break the sync it is
reporting on. CS_NO_TOAST=1 in the environment silences it.
"""

import base64
import os
import subprocess
import sys
from xml.sax.saxutils import escape

APP_ID = r"{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
QUIET = 0x08000000  # CREATE_NO_WINDOW

SCRIPT = """
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument
$x.LoadXml(@'
<toast><visual><binding template="ToastGeneric"><text>{title}</text><text>{body}</text></binding></visual></toast>
'@)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{app}').Show([Windows.UI.Notifications.ToastNotification]::new($x))
"""


def toast(title, body):
    if sys.platform != "win32" or os.environ.get("CS_NO_TOAST"):
        return
    try:
        ps = SCRIPT.replace("{title}", escape(title)).replace("{body}", escape(body[:600])) \
                   .replace("{app}", APP_ID)
        enc = base64.b64encode(ps.encode("utf-16-le")).decode()
        subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", enc],
                       capture_output=True, timeout=30, creationflags=QUIET)
    except Exception:
        pass


if __name__ == "__main__":
    toast("CS sync — test", "If you can read this, failure alerts will reach you.")
