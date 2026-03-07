/**
 * MQTT connection settings view — shown before the main app when MQTT is not connected.
 * Allows users to configure broker URL, gateway ID, and secret key.
 * Supports generating new gateway ID + secret key pairs.
 */

import { html, type TemplateResult } from "lit";
import { i18n } from "../../i18n/index.ts";
import { generateGatewayId, generateSecretKey } from "../mqtt-crypto.ts";

const MQTT_SETTINGS_KEY = "openclaw.mqtt.settings.v1";

export type MqttSettings = {
  brokerUrl: string;
  gatewayId: string;
  secretKey: string;
};

const DEFAULT_BROKER_URL = "wss://broker.emqx.io:8084/mqtt";

export function loadMqttSettings(): MqttSettings {
  const defaults: MqttSettings = {
    brokerUrl: DEFAULT_BROKER_URL,
    gatewayId: "",
    secretKey: "",
  };
  try {
    const raw = localStorage.getItem(MQTT_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MqttSettings>;
    return {
      brokerUrl:
        typeof parsed.brokerUrl === "string" && parsed.brokerUrl.trim()
          ? parsed.brokerUrl.trim()
          : defaults.brokerUrl,
      gatewayId:
        typeof parsed.gatewayId === "string" ? parsed.gatewayId.trim() : defaults.gatewayId,
      secretKey: typeof parsed.secretKey === "string" ? parsed.secretKey : defaults.secretKey,
    };
  } catch {
    return defaults;
  }
}

export function saveMqttSettings(settings: MqttSettings): void {
  localStorage.setItem(MQTT_SETTINGS_KEY, JSON.stringify(settings));
}

export type MqttSettingsCallbacks = {
  onConnect: (settings: MqttSettings) => void;
  onFieldChange: (field: keyof MqttSettings, value: string) => void;
  onGenerate: () => void;
};

/** Generate a new gateway ID + secret key pair. */
export function generateCredentials(): { gatewayId: string; secretKey: string } {
  return {
    gatewayId: generateGatewayId(),
    secretKey: generateSecretKey(),
  };
}

function copyToClipboard(text: string, buttonEl: HTMLButtonElement): void {
  void navigator.clipboard.writeText(text).then(() => {
    const original = buttonEl.textContent;
    buttonEl.textContent = "✓";
    setTimeout(() => {
      buttonEl.textContent = original;
    }, 1500);
  });
}

export function renderMqttSettings(
  settings: MqttSettings,
  callbacks: MqttSettingsCallbacks,
  error: string | null,
  connecting: boolean,
): TemplateResult {
  const t = i18n.t.bind(i18n);
  const canConnect = settings.gatewayId.trim() && settings.secretKey.trim();

  return html`
    <div class="mqtt-settings">
      <div class="mqtt-settings-card">
        <h2 class="mqtt-settings-title">${t("mqtt.title")}</h2>
        <p class="mqtt-settings-desc">${t("mqtt.description")}</p>

        ${error
          ? html`<div class="mqtt-settings-error">${error}</div>`
          : ""}

        <div class="mqtt-settings-field">
          <label>${t("mqtt.brokerUrl")}</label>
          <input
            type="text"
            .value=${settings.brokerUrl}
            placeholder=${DEFAULT_BROKER_URL}
            @input=${(e: InputEvent) =>
              callbacks.onFieldChange("brokerUrl", (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="mqtt-settings-field">
          <label>${t("mqtt.gatewayId")}</label>
          <div class="mqtt-settings-input-row">
            <input
              type="text"
              .value=${settings.gatewayId}
              placeholder="gw-xxxxxxxx"
              @input=${(e: InputEvent) =>
                callbacks.onFieldChange("gatewayId", (e.target as HTMLInputElement).value)}
            />
            <button
              class="mqtt-settings-copy-btn"
              title="${t("mqtt.copy")}"
              ?disabled=${!settings.gatewayId}
              @click=${(e: MouseEvent) =>
                copyToClipboard(settings.gatewayId, e.currentTarget as HTMLButtonElement)}
            >${t("mqtt.copy")}</button>
          </div>
        </div>

        <div class="mqtt-settings-field">
          <label>${t("mqtt.secretKey")}</label>
          <div class="mqtt-settings-input-row">
            <input
              type="password"
              .value=${settings.secretKey}
              placeholder="Base64 encoded 256-bit key"
              @input=${(e: InputEvent) =>
                callbacks.onFieldChange("secretKey", (e.target as HTMLInputElement).value)}
            />
            <button
              class="mqtt-settings-copy-btn"
              title="${t("mqtt.copy")}"
              ?disabled=${!settings.secretKey}
              @click=${(e: MouseEvent) =>
                copyToClipboard(settings.secretKey, e.currentTarget as HTMLButtonElement)}
            >${t("mqtt.copy")}</button>
          </div>
        </div>

        <div class="mqtt-settings-actions">
          <button
            class="mqtt-settings-generate-btn"
            @click=${() => callbacks.onGenerate()}
          >${t("mqtt.generate")}</button>

          <button
            class="mqtt-settings-connect-btn"
            ?disabled=${!canConnect || connecting}
            @click=${() => {
              if (canConnect && !connecting) {
                saveMqttSettings(settings);
                callbacks.onConnect(settings);
              }
            }}
          >${connecting ? t("mqtt.connecting") : t("mqtt.connect")}</button>
        </div>

        <p class="mqtt-settings-hint">${t("mqtt.hint")}</p>
      </div>
    </div>
  `;
}
