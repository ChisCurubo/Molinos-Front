# Despliegue del front (Caddy)

El navegador siempre llama a `/api/v1` en el mismo origen. Quién lo reenvía al backend depende del modo:

| Modo | Se detecta por | Quién sirve | URL |
|---|---|---|---|
| `local` | host `localhost`, `192.168.x`, `10.x` (salvo 10.0.1.20), `172.16-31.x`, `*.local` | Vite (`npm run dev` / `npm run preview`) o Caddy local | `http://localhost:5173`, `:4173` o `:8080` |
| `oracle` | cualquier otro host | Caddy en la VM `molinos-front` (10.0.1.20) | `https://<ip-publica-con-guiones>.sslip.io` |

`deploy/setup-front.sh` elige el modo con `hostname -I` (oracle si contiene 10.0.1.20); se fuerza con `MODO=local|oracle`.

## Actualizar el servidor
```
ssh -i molinos_oracle_ed25519 ubuntu@<ip-publica-front> 'sudo /opt/molinos/update.sh'
```
Logs: `docker compose -p molinos-front logs --tail 100 web`

## Probar Caddy en tu PC (Git Bash + Docker Desktop)
```
MODO=local bash deploy/setup-front.sh      # http://localhost:8080
docker compose -p molinos-front down
```

## Después de conocer la URL
Ponerla en el backend: `FRONT_URL` en `/opt/molinos/front_url.env` de la VM back (CORS en modo oracle).

## Notas
- Los certificados viven en el volumen `caddy-data`: no borrarlo (Let's Encrypt limita renovaciones).
- Health: `setup-front.sh` prueba `/api/v1/health` (200) y, si el backend es viejo (404), `/api/v1/info/health` (200 o 401).
- Plan B si sslip.io falla: `SITE=<ip-con-guiones>.nip.io sudo -E bash deploy/setup-front.sh`.
