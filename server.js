const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const filePath = path.join(__dirname, 'document.tex');

// 1. Read existing file on startup
app.get('/load', (req, res) => {
    // If file doesn't exist yet, create an empty one
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '% Start typing your LaTeX here...\n', 'utf8');
    }
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error reading file");
        res.json({ text: data });
    });
});

// 2. Save changes
app.post('/save', (req, res) => {
    const { text } = req.body;
    fs.writeFile(filePath, text, (err) => {
        if (err) return res.status(500).send("Error saving file");
        res.send("Saved successfully");
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
