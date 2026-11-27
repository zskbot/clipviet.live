# ClipViet · Jasna local GPU bridge

This is a small, original local wrapper around the separately installed Jasna command-line application. It does **not** copy, bundle, modify, or host Jasna itself. It runs only on the user's own computer and binds to `127.0.0.1`; it does not create a public endpoint, cloud GPU service, D1/R2 upload, or database record.

## Platform boundary

- Jasna is a Python/GPU desktop application. It is not a browser JavaScript library and does not run inside iPhone Safari.
- The ClipViet web page can submit a local file to this bridge only when opened in a desktop browser on the same computer where Jasna and the bridge are running.
- The uploaded bytes travel to loopback on that computer, not to ClipViet servers.
- The bridge invokes the installed CLI with an argument array and `shell=False`; it does not evaluate shell commands.

## Install

1. Download the official Jasna release for your OS/GPU from [zskbot/jasna releases](https://github.com/zskbot/jasna/releases). Review the fork and upstream notices first.
2. Install/run Jasna normally once so its required models and runtime are prepared.
3. Install Python 3.12 or newer for this bridge.
4. Keep the bridge work folder on a local disk with an ASCII-only path (for example `C:\\ClipViet-Jasna` or `~/ClipViet-Jasna`).

### Windows PowerShell

```powershell
$env:JASNA_BIN = "C:\\Jasna\\jasna.exe"
$env:JASNA_WORKDIR = "C:\\ClipViet-Jasna"
$env:CLIPVIET_JASNA_TOKEN = (& py -3.12 -c "import secrets; print(secrets.token_urlsafe(32))").Trim()
py -3.12 bridge.py
```

Copy the one-time token printed in the terminal into the ClipViet page. Do not put it in source code, URLs, screenshots, or shared logs.

### Linux

```bash
export JASNA_BIN="$HOME/Applications/jasna/jasna"
export JASNA_WORKDIR="$HOME/ClipViet-Jasna"
export CLIPVIET_JASNA_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 bridge.py
```

If Jasna is already on `PATH`, `JASNA_BIN` can remain `jasna`.

## Use

1. Open ClipViet's **Jasna GPU** page in a desktop browser on the same computer.
2. Confirm the local bridge status is online.
3. Paste the token shown by the local terminal. The page keeps it in memory only.
4. Choose a local video file and confirm you have processing/distribution rights and that every person depicted is an adult who consented to this processing.
5. Submit the job. The output is written locally as `*-restored.mkv`; download it from the page when complete.

Supported extensions: MP4, MKV, MOV, WebM, AVI and M4V. Default maximum upload is 8 GiB; override with `CLIPVIET_JASNA_MAX_BYTES`. Only one GPU job runs at a time.

## Security model

- Loopback bind only: `127.0.0.1`.
- A random token is generated at startup if `CLIPVIET_JASNA_TOKEN` is not set.
- Browser origins are allowlisted for ClipViet domains and the two Cloudflare Pages preview project patterns. Override exact production/staging origins with `CLIPVIET_ALLOWED_ORIGINS`.
- The bridge requires explicit rights and consent attestations.
- It never accepts a remote URL, never downloads a source URL, never writes to ClipViet's D1/R2/database, and never returns the local processing log to the browser.
- Keep the terminal open while a job runs. Stop the bridge with Ctrl+C.

## License and notices

Jasna is a separate AGPL-3.0 project; its models, bundled dependencies and supporter features may have separate terms. This wrapper calls the installed executable as a separate process and includes no Jasna source or model weights. See [the Jasna fork](https://github.com/zskbot/jasna), [upstream](https://github.com/Kruk2/jasna), and the notices in those repositories. Do not redistribute Jasna binaries, model weights, supporter keys, or modified builds without following their applicable terms.
