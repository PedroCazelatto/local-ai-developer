// The docker-compose body /new-project writes into a scaffolded project.
//
// The `runner` service is NETWORKED + hardened (the pivot reverses the old network_mode:none):
// rootless user + CPU/RAM caps, network ON so run_in_project's `npm i` / `pip install` work. The
// service name is exactly `runner` — run_in_project (V1/05) targets it by that name.

/** node:24-slim / python:3.13-slim runner. Do NOT set network_mode: none — installs need the net. */
export function runnerCompose(image: string): string {
  return `services:
  runner:
    image: ${image}
    working_dir: /workspace
    volumes:
      - .:/workspace
    # Rootless: the model's toolchain runs as a non-root uid, never root.
    user: "1000:1000"
    # Hardened caps (a 3060 box; CPU-bound container work). Keep modest.
    mem_limit: 2g
    cpus: 2.0
    # Network stays ON (compose default) so run_in_project can install deps. Do not disable it.
`;
}
