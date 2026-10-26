use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayState {
    pub session_id: Option<String>,
    pub sequence: Option<u64>,
    pub resume_gateway_url: Option<String>,
    pub heartbeat_interval_ms: u64,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            session_id: None,
            sequence: None,
            resume_gateway_url: None,
            heartbeat_interval_ms: 41250,
        }
    }
}

pub struct GatewayManager {
    pub state: GatewayState,
}

impl GatewayManager {
    pub fn new() -> Self {
        Self {
            state: GatewayState::default(),
        }
    }

    /// Calcula un jitter aleatorio de ±5% para el heartbeat para emular latencia natural humana/red
    pub fn calculate_jittered_heartbeat(&self) -> u64 {
        // En Fase 3 se integrará con rand para fluctuaciones orgánicas
        self.state.heartbeat_interval_ms
    }
}
