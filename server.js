const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express(); // <--- Esta es la línea que faltaba arriba
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

let activeProcess = null;

// 1. LISTAR ARCHIVOS Y CARPETAS
app.get('/api/list', (req, res) => {
    const dirPath = req.query.path || '/sdcard';
    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const list = files.map(f => ({
            name: f.name,
            path: path.join(dirPath, f.name),
            type: f.isDirectory() ? 'dir' : 'file'
        }));
        res.json(list);
    });
});

// 2. ABRIR ARCHIVO
app.get('/api/open', (req, res) => {
    const filePath = req.query.file;
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send(err.message);
        res.send(data);
    });
});

// 3. GUARDAR O CREAR ARCHIVO
app.post('/api/save', (req, res) => {
    const { file, content } = req.body;
    fs.writeFile(file, content || '', 'utf8', (err) => {
        if (err) return res.status(500).send(err.message);
        res.send('Guardado');
    });
});

// 4. CREAR CARPETA
app.post('/api/mkdir', (req, res) => {
    const { path: dirPath } = req.body;
    fs.mkdir(dirPath, { recursive: true }, (err) => {
        if (err) return res.status(500).send(err.message);
        res.send('Carpeta creada');
    });
});

// 5. ELIMINAR (La función que causó el error, ahora en su lugar correcto)
app.post('/api/delete', (req, res) => {
    const { path: itemPath } = req.body;
    if (!itemPath || itemPath === '/sdcard') return res.status(403).send("No permitido");

    fs.rm(itemPath, { recursive: true, force: true }, (err) => {
        if (err) return res.status(500).send(err.message);
        res.send('Eliminado');
    });
});

// 6. EJECUTAR CÓDIGO
app.post('/api/run', (req, res) => {
    const { file } = req.body;
    if (!file) return res.send("Selecciona un archivo.");

    const ext = path.extname(file);
    let cmd = '';
    if (ext === '.py') cmd = 'python';
    else if (ext === '.js') cmd = 'node';
    else if (ext === '.sh') cmd = 'bash';
    else return res.send("Extensión no ejecutable.");

    if (activeProcess) activeProcess.kill();
    activeProcess = spawn(cmd, [file]);

    let outputData = "";
    activeProcess.stdout.on('data', (d) => outputData += d.toString());
    activeProcess.stderr.on('data', (d) => outputData += d.toString());
    activeProcess.on('close', () => activeProcess = null);

    setTimeout(() => res.send(outputData || "Ejecutando..."), 500);
});

// 7. ENTRADA DE DATOS (INPUT)
app.post('/api/input', (req, res) => {
    const { text } = req.body;
    if (activeProcess && activeProcess.stdin.writable) {
        activeProcess.stdin.write(text + "\n");
        res.send("Input enviado");
    } else {
        res.status(400).send("No hay proceso activo");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
