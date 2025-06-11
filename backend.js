const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración para PostgreSQL (tu base de datos en Render))
const pool = new Pool({
    user: 'inventarios_dnlr_user',
    host: 'dpg-d14s4eqli9vc73altdg0-a.oregon-postgres.render.com',
    database: 'inventarios_dnlr',
    password: 'RpzOEdvuTdgG53bm7grYJXoxjzmaq7xa',
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
});

// --- CREAR TABLAS SI NO EXISTEN ---
async function crearTablas() {
    try {
        // Nuevos productos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS NuevosProductos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) UNIQUE NOT NULL,
                cantidad_inicial INT NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Entradas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Entradas (
                id SERIAL PRIMARY KEY,
                producto VARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                equipo VARCHAR(200)
            );
        `);

        // Salidas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Salidas (
                id SERIAL PRIMARY KEY,
                producto VARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                equipo VARCHAR(200)
            );
        `);

        // Inventario
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Inventario (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) UNIQUE NOT NULL,
                cantidad INT NOT NULL
            );
        `);

        // Movimientos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Movimientos (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(20) NOT NULL,
                producto VARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                equipo VARCHAR(200)
            );
        `);

        console.log('Tablas verificadas/creadas correctamente.');
    } catch (err) {
        console.error('Error creando tablas:', err.message);
    }
}

// Llama a crearTablas al iniciar el backend
crearTablas();

// --- ENDPOINTS ---

// Obtener inventario
app.get('/api/inventario', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, cantidad FROM Inventario');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agregar producto nuevo
app.post('/api/inventario', async (req, res) => {
    const { nombre, cantidad } = req.body;
    try {
        const existe = await pool.query(
          'SELECT COUNT(*) as total FROM Inventario WHERE LOWER(nombre) = LOWER($1)', 
          [nombre]
        );

        if (parseInt(existe.rows[0].total) > 0) {
            return res.status(400).json({ error: 'El producto ya existe.' });
        }

        await pool.query(
          'INSERT INTO Inventario (nombre, cantidad) VALUES ($1, $2)', 
          [nombre, cantidad]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registrar entrada
app.post('/api/entrada', async (req, res) => {
    const { nombre, cantidad, equipo } = req.body;
    try {
        await pool.query(
          'UPDATE Inventario SET cantidad = cantidad + $1 WHERE LOWER(nombre) = LOWER($2)', 
          [cantidad, nombre]
        );

        await pool.query(
          'INSERT INTO Movimientos (tipo, producto, cantidad, fecha, equipo) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)', 
          ['Entrada', nombre, cantidad, equipo]
        );

        await pool.query(
          'INSERT INTO Entradas (producto, cantidad, fecha, equipo) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)', 
          [nombre, cantidad, equipo]
        );

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registrar salida
app.post('/api/salida', async (req, res) => {
    const { nombre, cantidad, equipo } = req.body;
    try {
        const result = await pool.query(
          'SELECT cantidad FROM Inventario WHERE LOWER(nombre) = LOWER($1)', 
          [nombre]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        if (result.rows[0].cantidad < cantidad) {
            return res.status(400).json({ error: 'No hay suficiente stock.' });
        }

        await pool.query(
          'UPDATE Inventario SET cantidad = cantidad - $1 WHERE LOWER(nombre) = LOWER($2)', 
          [cantidad, nombre]
        );

        await pool.query(
          'INSERT INTO Movimientos (tipo, producto, cantidad, fecha, equipo) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)', 
          ['Salida', nombre, cantidad, equipo]
        );

        await pool.query(
          'INSERT INTO Salidas (producto, cantidad, fecha, equipo) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)', 
          [nombre, cantidad, equipo]
        );

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener movimientos
app.get('/api/movimientos', async (req, res) => {
    try {
        const result = await pool.query(
          'SELECT tipo, producto, cantidad, fecha, equipo FROM Movimientos ORDER BY fecha DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener entradas
app.get('/api/entradas', async (req, res) => {
    try {
        const result = await pool.query(
          'SELECT producto, cantidad, fecha, equipo FROM Entradas ORDER BY fecha DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener salidas
app.get('/api/salidas', async (req, res) => {
    try {
        const result = await pool.query(
          'SELECT producto, cantidad, fecha, equipo FROM Salidas ORDER BY fecha DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INICIAR SERVIDOR ---
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
});
