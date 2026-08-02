#!/usr/bin/env python3
"""
fetch_zabbix_stats.py — Zabbix 7.x (autenticação via API Token)

No Zabbix 7.x com API Token:
  - NÃO é necessário user.login / user.logout
  - Basta enviar o token direto no header "Authorization: Bearer <token>"
  - Isso evita o bloqueio temporário por tentativas de login (-32500)
"""
import os
import json
import requests
from datetime import datetime, timezone

ZABBIX_URL   = os.environ["ZABBIX_URL"].strip().rstrip("/")
ZABBIX_TOKEN = os.environ["ZABBIX_TOKEN"].strip()

OUTPUT_FILE = "assets/data/stats.json"
API_URL = f"{ZABBIX_URL}/api_jsonrpc.php"

_req_id = 0


def rpc(method, params, use_auth=True):
    global _req_id
    _req_id += 1
    headers = {"Content-Type": "application/json-rpc"}
    if use_auth:
        headers["Authorization"] = f"Bearer {ZABBIX_TOKEN}"
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
    print(f"[debug] ZABBIX_TOKEN length: {len(ZABBIX_TOKEN)}")

    # Versão da API — Zabbix exige que esta chamada NÃO tenha header de auth
    version = rpc("apiinfo.version", {}, use_auth=False)
    print(f"[zabbix] Versão da API: {version}")

    # Total de hosts monitorados (status=0 = enabled)
    total_devices = int(rpc("host.get", {
        "countOutput": True,
        "filter": {"status": 0},
    }))
    print(f"[zabbix] Hosts monitorados: {total_devices}")

    # Problemas ativos
    try:
        total_problems = int(rpc("problem.get", {
            "countOutput": True,
            "recent":      True,
        }))
    except Exception as e:
        print(f"[zabbix] Aviso — problem.get falhou: {e}")
        total_problems = 0
    print(f"[zabbix] Problemas ativos: {total_problems}")

    # Não há logout necessário com API Token — ele não expira por sessão

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
