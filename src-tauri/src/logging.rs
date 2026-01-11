use chrono::Local;
use fern::colors::{Color, ColoredLevelConfig};
use log::LevelFilter;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES: usize = 5;

pub fn get_log_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join("s5cmd-gui").join("logs"))
}

pub fn get_log_path() -> Option<PathBuf> {
    LOG_PATH.lock().ok().and_then(|guard| guard.clone())
}

fn rotate_logs(log_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    if !log_path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(log_path)?;
    if metadata.len() < MAX_LOG_SIZE {
        return Ok(());
    }

    let log_dir = log_path.parent().ok_or("Invalid log path")?;
    let stem = log_path.file_stem().ok_or("Invalid log file name")?;
    let extension = log_path.extension().unwrap_or_default();

    // Rotate existing logs
    for i in (1..MAX_LOG_FILES).rev() {
        let old_path = log_dir.join(format!(
            "{}.{}.{}",
            stem.to_string_lossy(),
            i,
            extension.to_string_lossy()
        ));
        let new_path = log_dir.join(format!(
            "{}.{}.{}",
            stem.to_string_lossy(),
            i + 1,
            extension.to_string_lossy()
        ));

        if old_path.exists() {
            if i + 1 >= MAX_LOG_FILES {
                fs::remove_file(&old_path)?;
            } else {
                fs::rename(&old_path, &new_path)?;
            }
        }
    }

    // Move current log to .1
    let first_backup = log_dir.join(format!(
        "{}.1.{}",
        stem.to_string_lossy(),
        extension.to_string_lossy()
    ));
    fs::rename(log_path, first_backup)?;

    Ok(())
}

pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    let log_dir = get_log_dir().ok_or("Could not determine log directory")?;
    fs::create_dir_all(&log_dir)?;

    let log_path = log_dir.join("s5cmd-gui.log");

    // Rotate logs if needed
    rotate_logs(&log_path)?;

    // Store the path
    if let Ok(mut guard) = LOG_PATH.lock() {
        *guard = Some(log_path.clone());
    }

    let colors = ColoredLevelConfig::new()
        .error(Color::Red)
        .warn(Color::Yellow)
        .info(Color::Green)
        .debug(Color::Blue)
        .trace(Color::White);

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;

    fern::Dispatch::new()
        .format(move |out, message, record| {
            out.finish(format_args!(
                "[{} {} {}] {}",
                Local::now().format("%Y-%m-%d %H:%M:%S"),
                colors.color(record.level()),
                record.target(),
                message
            ))
        })
        .level(LevelFilter::Info)
        .level_for("s5cmd_gui", LevelFilter::Debug)
        .chain(std::io::stdout())
        .chain(file)
        .apply()?;

    Ok(())
}

pub fn read_logs(lines: Option<usize>) -> Result<Vec<String>, String> {
    let log_path = get_log_path().ok_or("Log path not initialized")?;

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_path).map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);

    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(Result::ok)
        .collect();

    match lines {
        Some(n) => Ok(all_lines.into_iter().rev().take(n).rev().collect()),
        None => Ok(all_lines),
    }
}

pub fn clear() -> Result<(), String> {
    let log_path = get_log_path().ok_or("Log path not initialized")?;

    if log_path.exists() {
        // Truncate the file instead of deleting
        let mut file = OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(&log_path)
            .map_err(|e| format!("Failed to clear log file: {}", e))?;

        writeln!(file, "[{}] Log file cleared", Local::now().format("%Y-%m-%d %H:%M:%S"))
            .map_err(|e| format!("Failed to write to log file: {}", e))?;
    }

    Ok(())
}
