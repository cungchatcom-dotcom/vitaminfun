#!/usr/bin/env bash
#
# BUOC PHAT HANH cua frontend: cai thu vien va build.
#
# Khong chay `pnpm start` o day — cung ly do voi deploy-api.sh: build la viec
# lam mot lan moi lan deploy, con chay la viec cua systemd.
#
# `--frozen-lockfile`: server khong duoc tu y nang phu thuoc. Lockfile lech voi
# package.json thi DUNG LAI va bao loi, thay vi cai mot to hop thu vien chua ai
# tung chay thu.
#
#   ./scripts/deploy-web.sh
#
set -euo pipefail

cd "$(dirname "$0")/../web"

pnpm install --frozen-lockfile
pnpm build
