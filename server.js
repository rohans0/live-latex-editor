const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

// Target explicit directories
const FILES_DIR = path.join(__dirname, 'files');
const BACKUP_DIR = path.join(__dirname, 'files_backup');

// Helper to keep paths safe and trapped inside the server/files/ directory
const getSafePath = (filename) => {
    if (!filename) return null;
    const safeName = path.basename(filename);
    return path.join(FILES_DIR, safeName);
};

// 1. Scan subfolder and return ONLY existing files
app.get('/files', (req, res) => {
    fs.readdir(FILES_DIR, (err, files) => {
        if (err) {
            console.error("Directory read error:", err);
            return res.status(500).send("Error reading directory");
        }
        
        const texFiles = files.filter(file => file.endsWith('.tex'));
        return res.json(texFiles);
    });
});

// 2. Read requested files from the server/files/ directory (No auto-creation)
app.get('/load', (req, res) => {
    const targetPath = getSafePath(req.query.file);
    
    if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).send("File not found");
    }
    
    fs.readFile(targetPath, 'utf8', (err, data) => {
        if (err) {
            console.error("File read error:", err);
            return res.status(500).send("Error reading file");
        }
        return res.json({ text: data });
    });
});

// 3. Save updates into the server/files/ directory (Only if the file already exists)
app.post('/save', (req, res) => {
    const { file, text } = req.body;
    const targetPath = getSafePath(file);
    
    if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).send("Cannot save: File does not exist");
    }
    
    fs.writeFile(targetPath, text, (err) => {
        if (err) {
            console.error("File write error:", err);
            return res.status(500).send("Error saving file");
        }
        return res.send("Saved successfully");
    });
});

// --- AUTOMATIC BACKUP MECHANISM ---
function runBackupRoutine() {
    // Ensure the backup destination directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    fs.readdir(FILES_DIR, (err, files) => {
        if (err) {
            console.error("Backup failed during directory scan:", err);
            return;
        }

        files.forEach(file => {
            const srcPath = path.join(FILES_DIR, file);
            const destPath = path.join(BACKUP_DIR, file);

            // Copy file asynchronously to keep main thread completely unblocked
            fs.copyFile(srcPath, destPath, (copyErr) => {
                if (copyErr) {
                    console.error(`Failed backing up file: ${file}`, copyErr);
                }
            });
        });
        
        console.log(`Snapshot of 'files/' backed up to 'files_backup/' successfully.`);
    });
}

// Spin up the interval process to execute every 3 minutes
setInterval(runBackupRoutine, 180000);


// --- CRITICAL PRE-FLIGHT CHECK ---
if (!fs.existsSync(FILES_DIR)) {
    console.error("CRITICAL ERROR: The 'files/' directory does not exist. Server execution halted.");
    process.exit(1);
}

const baselineFiles = fs.readdirSync(FILES_DIR);
const targetTexFiles = baselineFiles.filter(file => file.endsWith('.tex'));

if (targetTexFiles.length === 0) {
    console.error("CRITICAL ERROR: No '.tex' files found inside 'files/'. Server execution halted.");
    process.exit(1);
}

// Start server listening routine
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Run an initial backup immediately on launch so you don't wait 2 minutes for the first save state
    runBackupRoutine(); 
});
