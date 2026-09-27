#!/usr/bin/env bash
#
# BUOC PHAT HANH cua backend: cai thu vien, chay migration, seed.
#
# CO Y khong chay server o day. Buoc phat hanh chay MOT LAN moi lan deploy;
# server thi systemd giu chay va khoi dong lai moi khi no chet. Gop lam mot thi
# `Restart=always` bien thanh: cu moi lan API chet la pip va alembic chay lai —
# va mot vong lap chet se chay migration hang chuc lan mot phut.
#
# Chay lai bao nhieu lan cung duoc: `upgrade head` bo qua migration da chay,
# seed thay tai khoan da co thi khong dung vao mat khau.
#
#   ./scripts/deploy-api.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -x api/.venv/bin/python ]; then
  echo "Chua co api/.venv. Tao truoc:  python3.12 -m venv api/.venv" >&2
  exit 1
fi

api/.venv/bin/python -m pip install --upgrade pip
api/.venv/bin/python -m pip install -r api/requirements.txt

# `cd api` vi alembic.ini nam o do va duong dan trong no la tuong doi.
cd api
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seeds.seed_all
