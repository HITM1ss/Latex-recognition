use std::sync::Mutex;

use crate::worker::FormulaWorker;

pub struct AppState {
    pub worker: Mutex<Option<FormulaWorker>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            worker: Mutex::new(None),
        }
    }
}
