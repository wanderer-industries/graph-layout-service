# graph-layout-service

Deterministic HTTP graph layout service used by Wanderer. The public API is engine-neutral; ELK Layered is the default engine and Dagre is an optional adapter.

## API

- `POST /v1/layout`
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

Request and response contracts are versioned in [`schemas/`](schemas/). Coordinates in the response are normalized top-left coordinates with bounds starting at `(0, 0)`.

## Run with Docker

The service does not need a public port when it runs next to Wanderer. Both containers only need to share an internal Docker network.

```yaml
services:
  layout-service:
    image: wandererltd/graph-layout-service:latest
    restart: unless-stopped
    networks:
      - wanderer-internal
    environment:
      PORT: 3000

  wanderer:
    environment:
      WANDERER_LAYOUT_SERVICE_ENABLED: "true"
      WANDERER_LAYOUT_SERVICE_BASE_URL: http://layout-service:3000
    depends_on:
      layout-service:
        condition: service_healthy
```

For a standalone smoke test:

```sh
docker run --rm -p 3000:3000 wandererltd/graph-layout-service:latest
curl http://localhost:3000/readyz
```

The published image supports `linux/amd64` and `linux/arm64`.

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

## Development

```sh
npm ci
npm run check
npm test
npm run build
```

For local development, run `npm run dev`. It builds the TypeScript sources first and starts the compiled server so worker threads do not inherit TypeScript loader or file-watcher state.

With a service running locally, `npm run benchmark` executes the graph classes and concurrency levels in `benchmark/matrix.json`.

The Wanderer devcontainer can build the sibling checkout without exposing port 3000 on the host:

```sh
WANDERER_LAYOUT_SERVICE_ENABLED=true docker compose -f .devcontainer/docker-compose.yml --profile layout up
```

## Releases

Releases use semantic version tags such as `v1.0.0`. Pushing a version tag publishes these Docker Hub tags:

- `1.0.0`
- `1.0`
- `1`
- `latest` for stable releases

Prerelease tags such as `v1.1.0-rc.1` do not update `latest`. The publish workflow requires the repository secrets `WANDERER_DOCKER_USER` and `WANDERER_DOCKER_PASSWORD`.

## License

MIT
