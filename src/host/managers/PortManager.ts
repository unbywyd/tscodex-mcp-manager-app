/**
 * PortManager - Centralized port allocation
 */

import getPort from 'get-port';

const BASE_PORT = 4100;
const MAX_PORT = 4999;

export class PortManager {
  private allocatedPorts: Map<string, number> = new Map();
  private usedPorts: Set<number> = new Set();

  /**
   * Allocate a port for a server instance
   * @param key Unique key (e.g., "serverId:workspaceId")
   * @returns Allocated port number
   */
  async allocate(key: string): Promise<number> {
    // Check if already allocated
    const existing = this.allocatedPorts.get(key);
    if (existing && !this.usedPorts.has(existing)) {
      // Verify port is still available
      const available = await this.isPortAvailable(existing);
      if (available) {
        this.usedPorts.add(existing);
        return existing;
      }
    }

    // Find a new available port
    const port = await getPort({
      port: this.getPortRange(),
      exclude: Array.from(this.usedPorts),
    });

    this.allocatedPorts.set(key, port);
    this.usedPorts.add(port);

    return port;
  }

  /**
   * Release a port
   * @param key Unique key
   */
  release(key: string): void {
    const port = this.allocatedPorts.get(key);
    if (port) {
      this.usedPorts.delete(port);
      // Keep the allocation for potential reuse
    }
  }

  /**
   * Get the port allocated to a key
   */
  getPort(key: string): number | undefined {
    return this.allocatedPorts.get(key);
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      const available = await getPort({ port: [port] });
      return available === port;
    } catch {
      return false;
    }
  }

  /**
   * Get port range for allocation
   */
  private getPortRange(): number[] {
    const ports: number[] = [];
    for (let p = BASE_PORT; p <= MAX_PORT; p++) {
      if (!this.usedPorts.has(p)) {
        ports.push(p);
      }
    }
    return ports;
  }

  /**
   * Allocate multiple ports at once
   */
  async allocateMultiple(keys: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const key of keys) {
      const port = await this.allocate(key);
      result.set(key, port);
    }
    return result;
  }

  /**
   * Release all ports
   */
  releaseAll(): void {
    this.usedPorts.clear();
  }

  /**
   * Get all allocated ports
   */
  getAllocations(): Map<string, number> {
    return new Map(this.allocatedPorts);
  }
}
