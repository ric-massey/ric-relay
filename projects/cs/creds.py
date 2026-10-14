#!/usr/bin/env python3
"""Windows Credential Manager, for the few secrets the CS room needs.

    python creds.py get <target>          prints the secret (for a child process)
    python creds.py set <target> < secret reads the secret from stdin, never argv

Secrets never go in this repo, in a file, or on a command line (where any
process listing would show them). Targets used:

    ric-terminal/steam-webapi   Steam Web API key            (steam.py)
    ric-terminal/cs-match-auth  match history auth code      (steam.py)
    ric-terminal/cs-bot         the demo bot's Steam login token (fetcher/)
"""

import ctypes
import sys
from ctypes import wintypes

CRED_TYPE_GENERIC = 1
CRED_PERSIST_LOCAL_MACHINE = 2


class CREDENTIAL(ctypes.Structure):
    _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                ("LastWritten", wintypes.FILETIME),
                ("CredentialBlobSize", wintypes.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_char)),
                ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
                ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                ("UserName", wintypes.LPWSTR)]


def _advapi():
    return ctypes.WinDLL("advapi32", use_last_error=True)


def get(target):
    if sys.platform != "win32":
        return None
    advapi = _advapi()
    ptr = ctypes.POINTER(CREDENTIAL)()
    if not advapi.CredReadW(target, CRED_TYPE_GENERIC, 0, ctypes.byref(ptr)):
        return None
    try:
        blob = ctypes.string_at(ptr.contents.CredentialBlob, ptr.contents.CredentialBlobSize)
        # cmdkey stores UTF-16; set() below does too
        return blob.decode("utf-16-le").strip() if b"\x00" in blob else blob.decode().strip()
    finally:
        advapi.CredFree(ptr)


def set_(target, secret, user="ric-terminal"):
    blob = secret.encode("utf-16-le")
    buf = ctypes.create_string_buffer(blob, len(blob))
    cred = CREDENTIAL()
    cred.Type = CRED_TYPE_GENERIC
    cred.TargetName = target
    cred.CredentialBlobSize = len(blob)
    cred.CredentialBlob = ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))
    cred.Persist = CRED_PERSIST_LOCAL_MACHINE
    cred.UserName = user
    if not _advapi().CredWriteW(ctypes.byref(cred), 0):
        raise OSError(ctypes.get_last_error(), "CredWriteW failed")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("get", "set"):
        raise SystemExit(__doc__)
    if sys.argv[1] == "get":
        v = get(sys.argv[2])
        if v is None:
            raise SystemExit(1)
        sys.stdout.write(v)
    else:
        set_(sys.argv[2], sys.stdin.read().strip())
