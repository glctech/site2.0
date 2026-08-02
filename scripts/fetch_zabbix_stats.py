#!/usr/bin/env python3
"""
fetch_zabbix_stats.py — Zabbix 7.x
No Zabbix 7.x:
  - Login: campo "username" (não "user")
  - Auth: header "Authorization: Bearer <token>" (não campo "auth" no body)
  - Logout: user.logout sem parâmetros
"""

import os
import json
import requests
from datetime import datetime, timezone

ZABBIX_URL  = os.environ["ZABBIX_URL"].rstrip("/")
ZABBIX_USER = os.environ["ZABBIX_USER"]
ZABBIX_PASS = os.environ["ZABBIX_PASS"]
OUTPUT_FILE = "assets/data/stats.json"

API_URL = f"{ZABBIX_URL}/api_jsonrpc.php"
_req_id = 0


def rpc(method, params, token=None):
    global _req_id
    _req_id += 1

    headers = {"Content-Type": "application/json-rpc"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "jsonrpc": "2.0",
        "method":  method,
        "params":  params,
        "id":      _req_id,
    }

    resp = requests.post(API_URL, json=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    if "error" in data:
        raise RuntimeError(f"Zabbix API erro [{data['error']['code']}]: {data['error']['data']}")

    return data["result"]


def main():
    print(f"[zabbix] Conectando em {ZABBIX_URL} ...")

    # Versão da API (sem auth)
    version = rpc("apiinfo.version", {})
    print(f"[zabbix] Versão da API: {version}")

    # Login
    token = rpc("user.login", {
        "username": ZABBIX_USER,
        "password": ZABBIX_PASS,
    })
    print(f"[zabbix] Login OK — token: {token[:8]}...")

    # Total de hosts monitorados (status=0 = enabled)
    total_devices = int(rpc("host.get", {
        "countOutput": True,
        "filter": {"status": 0},
    }, token=token))
    print(f"[zabbix] Hosts monitorados: {total_devices}")

    # Problemas ativos
    try:
        total_problems = int(rpc("problem.get", {
            "countOutput": True,
            "recent":      True,
        }, token=token))
    except Exception as e:
        print(f"[zabbix] Aviso — problem.get falhou: {e}")
        total_problems = 0
    print(f"[zabbix] Problemas ativos: {total_problems}")

    # Logout
    try:
        rpc("user.logout", {}, token=token)
        print("[zabbix] Logout OK")
    except Exception:
        pass

    # Salvar JSON
    stats = {
        "devices":    total_devices,
        "problems":   total_problems,
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"[zabbix] ✓ {OUTPUT_FILE} salvo: {stats}")


if __name__ == "__main__":
    main()
