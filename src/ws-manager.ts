import { WebSocket } from 'ws';

/**
 * Simple WebSocket Manager to handle agent notifications.
 */
class WSManager {
  private sockets: Set<WebSocket> = new Set();

  addSocket(socket: WebSocket) {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
  }

  broadcast(topic: string, data: any) {
    const payload = JSON.stringify({ topic, data, timestamp: new Date().toISOString() });
    console.log(`[WS] Broadcasting to ${topic}:`, data);
    this.sockets.forEach(socket => {
      try {
        if (socket && socket.readyState === 1) { // 1 is WebSocket.OPEN
          socket.send(payload);
        }
      } catch (e) {
        console.error('[WS Error] Failed to send message:', e);
      }
    });
  }

  notifyJobEvaluated(job_id: string, result: any) {
    this.broadcast(`jobs.${job_id}.evaluated`, result);
  }

  notifyJobSubmitted(job_id: string, deliverable: any) {
    this.broadcast(`jobs.${job_id}.submitted`, { job_id, deliverable });
  }

  notifyNewJob(job: any) {
    this.broadcast('jobs.new', job);
  }
}

export const wsManager = new WSManager();
