import { connect, type IClientOptions, type MqttClient } from "mqtt";
import type { Config } from "./config.js";

export function connectBroker(config: Config): MqttClient {
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
    resubscribe: true,
  };
  return connect(config.mqttUrl, options);
}

export function publishQos1(client: MqttClient, topic: string, payload: string) {
  return new Promise<void>((resolve, reject) => client.publish(topic, payload, { qos: 1, retain: false }, (error) => error ? reject(error) : resolve()));
}

export function subscribeQos1(client: MqttClient, topics: string[]) {
  return new Promise<void>((resolve, reject) => client.subscribe(topics, { qos: 1 }, (error) => error ? reject(error) : resolve()));
}
