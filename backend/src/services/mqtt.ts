import mqtt from 'mqtt';
import { prisma } from '../lib/prisma.js';

let client: mqtt.MqttClient | null = null;

type WashCommandType = 'start' | 'stop' | 'pause' | 'resume';
type MachineCommandType = 'restart' | 'maintenance_on' | 'maintenance_off';

interface MachineStatusPayload {
  espDeviceId: string;
  status: 'idle' | 'washing' | 'maintenance' | 'offline';
  currentStep?: number;
  progress?: number;
  sessionId?: string;
  firmwareVersion?: string;
}

const sessionProgressListeners = new Map<string, Set<(data: unknown) => void>>();

export function onSessionProgress(sessionId: string, callback: (data: unknown) => void) {
  if (!sessionProgressListeners.has(sessionId)) {
    sessionProgressListeners.set(sessionId, new Set());
  }
  sessionProgressListeners.get(sessionId)!.add(callback);

  return () => {
    sessionProgressListeners.get(sessionId)?.delete(callback);
    if (sessionProgressListeners.get(sessionId)?.size === 0) {
      sessionProgressListeners.delete(sessionId);
    }
  };
}

function notifyProgressListeners(sessionId: string, data: unknown) {
  sessionProgressListeners.get(sessionId)?.forEach((cb) => cb(data));
}

async function handleMachineStatus(topic: string, payload: MachineStatusPayload) {
  const { espDeviceId, status, currentStep, progress, sessionId, firmwareVersion } = payload;

  // Update machine status in DB
  await prisma.machine.updateMany({
    where: { espDeviceId },
    data: {
      status,
      lastHeartbeat: new Date(),
      ...(firmwareVersion && { firmwareVersion }),
    },
  });

  // If there's an active session, update its progress
  if (sessionId && (currentStep !== undefined || progress !== undefined)) {
    const updateData: Record<string, unknown> = {};
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (progress !== undefined) updateData.progress = progress;

    if (status === 'idle' && progress === 100) {
      updateData.washStatus = 'completed';
      updateData.completedAt = new Date();
    }

    await prisma.washSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    notifyProgressListeners(sessionId, { currentStep, progress, status });
  }
}

export function initMqtt() {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.log('MQTT_BROKER_URL not set — MQTT disabled');
    return;
  }

  client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log('MQTT connected');
    // Subscribe to all machine status topics
    client!.subscribe('roboss/+/+/status', (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else console.log('Subscribed to roboss/+/+/status');
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());

      // Topic format: roboss/{branchId}/{machineId}/status
      if (topic.endsWith('/status')) {
        await handleMachineStatus(topic, payload);
      }
    } catch (err) {
      console.error('MQTT message error:', err);
    }
  });

  client.on('error', (err) => console.error('MQTT error:', err));
  client.on('close', () => console.log('MQTT disconnected'));

  // Heartbeat checker — mark machines offline if no heartbeat for 2 minutes
  setInterval(async () => {
    const threshold = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.machine.updateMany({
      where: {
        status: { not: 'offline' },
        lastHeartbeat: { lt: threshold },
      },
      data: { status: 'offline' },
    });
  }, 60_000);
}

export function publishWashCommand(
  branchId: string,
  machineEspId: string,
  command: WashCommandType,
  payload: Record<string, unknown> = {}
) {
  if (!client?.connected) {
    console.warn('MQTT not connected — command not sent');
    return false;
  }

  const topic = `roboss/${branchId}/${machineEspId}/command`;
  client.publish(topic, JSON.stringify({ command, ...payload, timestamp: Date.now() }));
  return true;
}

export function publishMachineCommand(
  branchId: string,
  machineEspId: string,
  command: MachineCommandType
) {
  if (!client?.connected) return false;

  const topic = `roboss/${branchId}/${machineEspId}/manage`;
  client.publish(topic, JSON.stringify({ command, timestamp: Date.now() }));
  return true;
}

export function getMqttClient() {
  return client;
}
