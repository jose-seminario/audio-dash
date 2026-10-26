use crate::evasion::{SuperProperties, TlsSpoofFactory, TrackerFilter};
use rquest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde_json::Value;

pub struct DiscordRestClient {
    client: rquest::Client,
    token: Option<String>,
    super_properties_header: String,
}

impl DiscordRestClient {
    pub fn new(token: Option<String>, super_properties: &SuperProperties) -> Result<Self, String> {
        let client = TlsSpoofFactory::build_spoofed_client().map_err(|e| e.to_string())?;
        let super_props_b64 = super_properties.to_base64_header().map_err(|e| e.to_string())?;

        Ok(Self {
            client,
            token,
            super_properties_header: super_props_b64,
        })
    }

    /// Envía un mensaje a un canal usando la capa de evasión TLS/HTTP2
    pub async fn send_message(&self, channel_id: &str, content: &str) -> Result<Value, String> {
        let url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);

        if TrackerFilter::is_tracking_url(&url) {
            return Err("URL bloqueada por política anti-rastreo".to_string());
        }

        let mut headers = HeaderMap::new();
        if let Some(ref t) = self.token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(t).map_err(|e| e.to_string())?,
            );
        }

        headers.insert(
            "X-Super-Properties",
            HeaderValue::from_str(&self.super_properties_header).map_err(|e| e.to_string())?,
        );

        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9168 Chrome/128.0.6613.186 Electron/32.2.2 Safari/537.36"),
        );

        let body = serde_json::json!({
            "content": content,
            "nonce": null,
            "tts": false,
            "flags": 0
        });

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let json: Value = response.json().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Error HTTP {}: {}", status, json));
        }

        Ok(json)
    }
}
