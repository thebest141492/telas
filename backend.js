const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración para tu SQL Serverr
const config = {
    user: 'kike',
    password: '04',
    server: 'ENRIQUE-DELL\\SQLFERREIRA3',
    database: 'inventarios',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};


//sql.connect(config)
 // .then(() => console.log('✅ Conectado a SQL Server'))
  //.catch(err => console.error('❌ Error al conectar a SQL Server:', err));


// --- CREAR TABLAS SI NO EXISTEN ---
async function crearTablas() {
    try {
        await sql.connect(config);
        // Tabla de nuevos productos
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NuevosProductos' AND xtype='U')
            CREATE TABLE NuevosProductos (
                id INT IDENTITY PRIMARY KEY,
                nombre NVARCHAR(100) UNIQUE NOT NULL,
                cantidad_inicial INT NOT NULL,
                fecha_creacion DATETIME DEFAULT GETDATE()
            )
        `);
        // Tabla de entradas
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Entradas' AND xtype='U')
            CREATE TABLE Entradas (
                id INT IDENTITY PRIMARY KEY,
                producto NVARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha DATETIME DEFAULT GETDATE(),
                equipo NVARCHAR(200)
            )
        `);
        // Tabla de salidas
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Salidas' AND xtype='U')
            CREATE TABLE Salidas (
                id INT IDENTITY PRIMARY KEY,
                producto NVARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha DATETIME DEFAULT GETDATE(),
                equipo NVARCHAR(200)
            )
        `);
        // Tabla de inventario
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Inventario' AND xtype='U')
            CREATE TABLE Inventario (
                id INT IDENTITY PRIMARY KEY,
                nombre NVARCHAR(100) UNIQUE NOT NULL,
                cantidad INT NOT NULL
            )
        `);
        // Tabla de movimientos
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Movimientos' AND xtype='U')
            CREATE TABLE Movimientos (
                id INT IDENTITY PRIMARY KEY,
                tipo NVARCHAR(20) NOT NULL,
                producto NVARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                fecha DATETIME DEFAULT GETDATE(),
                equipo NVARCHAR(200)
            )
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
        await sql.connect(config);
        const result = await sql.query('SELECT id, nombre, cantidad FROM Inventario');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agregar producto nuevo
app.post('/api/inventario', async (req, res) => {
    const { nombre, cantidad } = req.body;
    try {
        await sql.connect(config);
        // Evitar duplicados
        const existe = await sql.query`SELECT COUNT(*) as total FROM Inventario WHERE LOWER(nombre) = LOWER(${nombre})`;
        if (existe.recordset[0].total > 0) {
            return res.status(400).json({ error: 'El producto ya existe.' });
        }
        await sql.query`INSERT INTO Inventario (nombre, cantidad) VALUES (${nombre}, ${cantidad})`;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registrar entrada
app.post('/api/entrada', async (req, res) => {
    const { nombre, cantidad, equipo } = req.body;
    try {
        await sql.connect(config);
        // Actualizar inventario
        await sql.query`UPDATE Inventario SET cantidad = cantidad + ${cantidad} WHERE LOWER(nombre) = LOWER(${nombre})`;
        // Registrar movimiento
        await sql.query`INSERT INTO Movimientos (tipo, producto, cantidad, fecha, equipo) VALUES ('Entrada', ${nombre}, ${cantidad}, GETDATE(), ${equipo})`;
        // Registrar en tabla Entradas
        await sql.query`INSERT INTO Entradas (producto, cantidad, fecha, equipo) VALUES (${nombre}, ${cantidad}, GETDATE(), ${equipo})`;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registrar salida
app.post('/api/salida', async (req, res) => {
    const { nombre, cantidad, equipo } = req.body;
    try {
        await sql.connect(config);
        // Verificar stock
        const result = await sql.query`SELECT cantidad FROM Inventario WHERE LOWER(nombre) = LOWER(${nombre})`;
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        if (result.recordset[0].cantidad < cantidad) {
            return res.status(400).json({ error: 'No hay suficiente stock.' });
        }
        // Actualizar inventario
        await sql.query`UPDATE Inventario SET cantidad = cantidad - ${cantidad} WHERE LOWER(nombre) = LOWER(${nombre})`;
        // Registrar movimiento
        await sql.query`INSERT INTO Movimientos (tipo, producto, cantidad, fecha, equipo) VALUES ('Salida', ${nombre}, ${cantidad}, GETDATE(), ${equipo})`;
        // Registrar en tabla Salidas
        await sql.query`INSERT INTO Salidas (producto, cantidad, fecha, equipo) VALUES (${nombre}, ${cantidad}, GETDATE(), ${equipo})`;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener movimientos
app.get('/api/movimientos', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT tipo, producto, cantidad, fecha, equipo FROM Movimientos ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener entradas
app.get('/api/entradas', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT producto, cantidad, fecha, equipo FROM Entradas ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener salidas
app.get('/api/salidas', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT producto, cantidad, fecha, equipo FROM Salidas ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});








// --- INICIAR SERVIDOR ---
const PORT = 5500;
app.listen(PORT, () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
});
