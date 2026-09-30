import { createMatchConfig } from "../engine/config.js";
export class ArenaStore {
  constructor(input) {
    this.nextConfig = createMatchConfig(input);
    this.activeConfig = this.nextConfig;
    this.status = "ready";
    this.snapshot = null;
  }
  edit(changes) {
    this.nextConfig = createMatchConfig({ ...this.nextConfig, ...changes });
    return this.nextConfig;
  }
  activate() {
    this.activeConfig = createMatchConfig(this.nextConfig);
    this.status = "ready";
    this.snapshot = null;
    return this.activeConfig;
  }
}
