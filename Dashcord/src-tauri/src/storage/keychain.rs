#[cfg(not(any(test, feature = "test-mock")))]
use keyring::Entry;

const SERVICE_NAME: &str = "DashCord";
const TOKEN_USER: &str = "discord_user_token";

#[cfg(any(test, feature = "test-mock"))]
use std::collections::HashMap;
#[cfg(any(test, feature = "test-mock"))]
use std::sync::Mutex;

#[cfg(any(test, feature = "test-mock"))]
static MOCK_KEYRING: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

pub struct KeychainManager;

impl KeychainManager {
    /// Guarda el token de forma segura en el Keychain del SO (o mock en tests)
    pub fn store_token(token: &str) -> Result<(), String> {
        #[cfg(any(test, feature = "test-mock"))]
        {
            let mut guard = MOCK_KEYRING.lock().map_err(|e| e.to_string())?;
            let map = guard.get_or_insert_with(HashMap::new);
            map.insert(format!("{}:{}", SERVICE_NAME, TOKEN_USER), token.to_string());
            Ok(())
        }

        #[cfg(not(any(test, feature = "test-mock")))]
        {
            let entry = Entry::new(SERVICE_NAME, TOKEN_USER).map_err(|e| e.to_string())?;
            entry.set_password(token).map_err(|e| e.to_string())
        }
    }

    /// Obtiene el token guardado
    pub fn get_token() -> Result<String, String> {
        #[cfg(any(test, feature = "test-mock"))]
        {
            let guard = MOCK_KEYRING.lock().map_err(|e| e.to_string())?;
            if let Some(map) = guard.as_ref() {
                if let Some(tok) = map.get(&format!("{}:{}", SERVICE_NAME, TOKEN_USER)) {
                    return Ok(tok.clone());
                }
            }
            Err("No token found in keyring".to_string())
        }

        #[cfg(not(any(test, feature = "test-mock")))]
        {
            let entry = Entry::new(SERVICE_NAME, TOKEN_USER).map_err(|e| e.to_string())?;
            entry.get_password().map_err(|e| e.to_string())
        }
    }

    /// Elimina el token del Keychain
    pub fn delete_token() -> Result<(), String> {
        #[cfg(any(test, feature = "test-mock"))]
        {
            let mut guard = MOCK_KEYRING.lock().map_err(|e| e.to_string())?;
            if let Some(map) = guard.as_mut() {
                map.remove(&format!("{}:{}", SERVICE_NAME, TOKEN_USER));
            }
            Ok(())
        }

        #[cfg(not(any(test, feature = "test-mock")))]
        {
            let entry = Entry::new(SERVICE_NAME, TOKEN_USER).map_err(|e| e.to_string())?;
            entry.delete_credential().map_err(|e| e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_load_delete_keychain_mock() {
        let test_token = "mfa.test_mock_token_secret_123456";

        // 1. Guardar token
        KeychainManager::store_token(test_token).expect("Error storing token in mock");

        // 2. Recuperar token
        let retrieved = KeychainManager::get_token().expect("Error retrieving token from mock");
        assert_eq!(retrieved, test_token);

        // 3. Eliminar token
        KeychainManager::delete_token().expect("Error deleting token from mock");

        // 4. Verificar que ya no existe
        assert!(KeychainManager::get_token().is_err());
    }
}
