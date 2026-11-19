import { connect as connectTls } from "node:tls";
import { MqttClient, type AckHandler, type IClientOptions } from "mqtt";
import type { Config } from "./config.js";

export function connectBroker(config: Config, customHandleAcks?: AckHandler): MqttClient {
  const broker = new URL(config.mqttUrl);
  const options: IClientOptions = {
    username: config.mqttUsername,
    password: config.mqttPassword,
    ca: config.mqttCa,
    rejectUnauthorized: true,
    clean: false,
    clientId: `nexora-bridge-${config.gatewayId}`,
    reconnectPeriod: 3000,
    connectTimeout: 15000,
    keepalive: 30,
    protocolVersion: 5,
    resubscribe: true,
    customHandleAcks,
  };
  return new MqttClient(() => connectTls({
    host: broker.hostname,
    port: Number(broker.port || 8883),
    servername: config.mqttTlsServername,
    ca: config.mqttCa,
    rejectUnauthorized: true,
  }), options);
}

export function publishQos1(client: MqttClient, topic: string, payload: string) {
  return new Promise<void>((resolve, reject) => client.publish(topic, payload, { qos: 1, retain: false }, (error) => error ? reject(error) : resolve()));
}

export function subscribeQos1(client: MqttClient, topics: string[]) {
  return new Promise<void>((resolve, reject) => client.subscribe(topics, { qos: 1 }, (error) => error ? reject(error) : resolve()));
}
