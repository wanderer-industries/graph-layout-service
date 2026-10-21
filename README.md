# graph-layout-service

Deterministic HTTP graph layout service used by Wanderer. The public API is engine-neutral; ELK Layered is the default engine and Dagre is an optional adapter.

## API

- `POST /v1/layout`
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

Request and response contracts are in `schemas/`. Coordinates in the response are normalized top-left coordinates with bounds starting at `(0, 0)`.

## Configuration

| Variable | Default |
| --- | ---: |
| `PORT` | `3000` |
| `LAYOUT_WORKER_COUNT` | half available CPUs, capped at 4 |
| `LAYOUT_MAX_NODES` | `2000` |
| `LAYOUT_MAX_EDGES` | `5000` |
| `LAYOUT_JOB_TIMEOUT_MS` | `15000` |
| `LAYOUT_MAX_QUEUE_LENGTH` | `100` |
| `LAYOUT_MAX_BODY_BYTES` | `5242880` |

Run `npm test`, `npm run check`, and `npm run build` before publishing an image.
With a service running locally, `npm run benchmark` executes the graph classes and concurrency levels in `benchmark/matrix.json`.

For local development, run `npm run dev`. It builds the TypeScript sources first and starts the compiled server so worker threads do not inherit TypeScript loader or file-watcher state.

The service is an independent project located next to the Wanderer repository. From the Wanderer repository root, its optional devcontainer service can be enabled without exposing port 3000 on the host:

```sh
WANDERER_LAYOUT_SERVICE_ENABLED=true docker compose -f .devcontainer/docker-compose.yml --profile layout up
```
