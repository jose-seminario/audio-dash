/// RAII guard for COM initialization on worker/secondary threads.
///
/// Ensures CoInitializeEx is called with COINIT_MULTITHREADED,
/// and CoUninitialize is only called on Drop if the initialization
/// actually succeeded (S_OK or S_FALSE). If COM was already initialized
/// on the thread (RPC_E_CHANGED_MODE), it leaves the existing apartment untouched.
#[cfg(windows)]
pub struct ComGuard {
    hr: windows::core::HRESULT,
}

#[cfg(windows)]
impl ComGuard {
    pub fn new_mta() -> Self {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        Self { hr }
    }
}

#[cfg(windows)]
impl Drop for ComGuard {
    fn drop(&mut self) {
        use windows::Win32::Foundation::{S_FALSE, S_OK};
        use windows::Win32::System::Com::CoUninitialize;

        // Solo desinicializar si este guard inicializó COM exitosamente
        if self.hr == S_OK || self.hr == S_FALSE {
            unsafe {
                CoUninitialize();
            }
        }
    }
}

#[cfg(not(windows))]
pub struct ComGuard;

#[cfg(not(windows))]
impl ComGuard {
    pub fn new_mta() -> Self {
        Self
    }
}
