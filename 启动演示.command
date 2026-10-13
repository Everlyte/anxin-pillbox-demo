#!/bin/zsh
cd -- "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  node server.mjs
elif [[ -x ${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ]]; then
  ${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
else
  echo '请先安装 Node.js 22 或更新版本。'
  read -r
fi
