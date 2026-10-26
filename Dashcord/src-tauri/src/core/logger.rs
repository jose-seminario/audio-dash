use std::path::PathBuf;
use tracing::{Event, Subscriber};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{
    fmt::{format::Writer, FmtContext, FormatEvent, FormatFields},
    layer::SubscriberExt,
    registry::LookupSpan,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};

/// Formateador personalizado que sanitiza automáticamente credenciales y cabeceras sensibles
pub struct SensitiveRedactFormatter;

impl<S, N> FormatEvent<S, N> for SensitiveRedactFormatter
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> std::fmt::Result {
        let meta = event.metadata();
        write!(
            writer,
            "{} [{}] {}: ",
            chrono::Utc::now().to_rfc3339(),
            meta.level(),
            meta.target()
        )?;

        // Sanitización de campos
        let mut visitor = RedactingVisitor(&mut writer);
        event.record(&mut visitor);
        writeln!(writer)
    }
}

struct RedactingVisitor<'a, 'w>(&'a mut Writer<'w>);

impl<'a, 'w> tracing::field::Visit for RedactingVisitor<'a, 'w> {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let name = field.name().to_lowercase();
        let value_str = format!("{:?}", value);

        if name.contains("authorization")
            || name.contains("cookie")
            || name.contains("token")
            || name.contains("x-super-properties")
            || name.contains("password")
            || name.contains("secret")
            || value_str.contains("mfa.")
            || value_str.contains("Bearer ")
        {
            let _ = write!(self.0, " {} = [REDACTED]", field.name());
        } else if name == "content" || name == "message_content" {
            let _ = write!(self.0, " {} = [MESSAGE_CONTENT_OMITTED]", field.name());
        } else {
            let _ = write!(self.0, " {} = {}", field.name(), value_str);
        }
    }
}

/// Inicializa el subsistema de telemetría y logs sanitizados
pub fn init_secure_logger(logs_dir: Option<PathBuf>) -> Result<(), String> {
    let dir = logs_dir.unwrap_or_else(|| PathBuf::from("logs"));
    
    // Rotación diaria con retención
    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("dashcord")
        .filename_suffix("log")
        .max_log_files(7) // Retención estricta de 7 días
        .build(dir)
        .map_err(|e| e.to_string())?;

    let file_layer = tracing_subscriber::fmt::layer()
        .event_format(SensitiveRedactFormatter)
        .with_writer(file_appender)
        .with_ansi(false);

    let stdout_layer = tracing_subscriber::fmt::layer()
        .event_format(SensitiveRedactFormatter)
        .with_ansi(true);

    // Nivel por defecto: INFO en debug, WARN en release
    #[cfg(debug_assertions)]
    let default_level = "info";
    #[cfg(not(debug_assertions))]
    let default_level = "warn";

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(default_level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(file_layer)
        .init();

    Ok(())
}
