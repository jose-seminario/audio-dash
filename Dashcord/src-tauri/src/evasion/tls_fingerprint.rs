use rquest::{Client, Impersonate};

/// Fábrica para construir el cliente HTTP rquest con suplantación de TLS
pub struct TlsSpoofFactory;

impl TlsSpoofFactory {
    /// Genera un cliente rquest configurado con la huella TLS de Google Chrome oficial
    pub fn build_spoofed_client() -> Result<Client, rquest::Error> {
        Client::builder()
            .impersonate(Impersonate::Chrome128)
            .cookie_store(true)
            .build()
    }
}
