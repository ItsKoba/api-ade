import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// PERUBAHAN UTAMA: Hanya import dari database.js
// Diasumsikan database.js adalah file mongodb.js yang sudah diperbarui
import * as db from './database.js';

// --- KONFIGURASI SERVER ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const BOT_ID = parseInt(process.env.BOT_ID);

if (!BOT_ID) {
    console.error("❌ BOT_ID tidak ditemukan di file .env. Pastikan Anda sudah mengaturnya.");
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- API ROUTES ---

// POST: Verifikasi password login
app.post('/api/auth/check', (req, res) => {
    try {
        const { password } = req.body;
        const correctPassword = process.env.PASSWORD;

        if (!password) {
            return res.status(400).json({ success: false, error: 'Password diperlukan.' });
        }

        if (password === correctPassword) {
            res.json({ success: true, message: 'Password benar' });
        } else {
            res.status(401).json({ success: false, error: 'Password salah' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Statistik (Total Transaksi & Pendapatan)
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.totalTransaksi(BOT_ID); // Menggunakan db (database.js)
        res.json({
            success: true,
            data: {
                totalPcs: stats.totalPcs || 0,
                totalPendapatan: stats.totalPendapatan || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Riwayat Transaksi
app.get('/api/transactions', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 0;
        const result = await db.getTransactionHistory(BOT_ID, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Riwayat Transaksi User Tertentu
// Parameter: userId (sesuai perubahan skema)
app.get('/api/transactions/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const result = await db.getUserTransactionHistory(parseInt(userId), limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Daftar User
app.get('/api/users', async (req, res) => {
    try {
        const { userId, limit } = req.query;
        if (userId) {
            const result = await db.getUserById(userId);
            return res.json(result);
        }

        const lim = limit ? parseInt(limit) : 50;
        const result = await db.getAllUsers(lim);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Cari user berdasarkan ID
app.get('/api/users/search/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.getUserById(userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// PUT: Edit role dan saldo user
// Parameter: userId (sesuai perubahan skema)
app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, role, balance } = req.body;
        const result = await db.updateUserRoleAndBalance(userId, name, role, balance);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan semua data bot
// Menggunakan BOT_ID dari env
app.get('/api/bot', async (req, res) => {
    try {
        const result = await db.dbBot(BOT_ID);
        if (result.success) {
            const botData = result.data;

            // Konversi Map product menjadi Object
            let productObj = {};
            if (botData.product instanceof Map) {
                for (const [key, value] of botData.product) {
                    // Di sini key adalah productId
                    productObj[key] = value;
                }
            } else {
                productObj = botData.product || {};
            }

            // Konversi Map product_view menjadi Object
            let product_viewObj = {};
            if (botData.product_view instanceof Map) {
                for (const [key, value] of botData.product_view) {
                    product_viewObj[key] = value;
                }
            } else {
                product_viewObj = botData.product_view || {};
            }

            // Return dengan struktur yang rapi
            res.json({
                success: true,
                data: {
                    ...botData,
                    product: productObj,
                    product_view: product_viewObj
                }
            });
        } else {
            console.log(result)
            res.status(404).json(result);
        }
    } catch (error) {
        console.log('[ERROR] /api/bot:', error);
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Semua Produk
app.get('/api/products', async (req, res) => {
    try {
        const result = await db.dbBot(BOT_ID);
        if (result.success) {
            const botData = result.data;
            
            // Konversi Map product menjadi Object
            let productObj = {};
            if (botData.product instanceof Map) {
                for (const [key, value] of botData.product) {
                    productObj[key] = value;
                }
            } else {
                productObj = botData.product || {};
            }
            
            // Convert to array format
            const products = Object.entries(productObj).map(([id, data]) => ({
                id,
                ...data
            }));
            
            res.json({ success: true, data: products });
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Mendapatkan Semua Product View (Kategori)
app.get('/api/product-view', async (req, res) => {
    try {
        const result = await db.dbBot(BOT_ID);
        if (result.success) {
            const botData = result.data;
            
            // Konversi Map product_view menjadi Object
            let productViewObj = {};
            if (botData.product_view instanceof Map) {
                for (const [key, value] of botData.product_view) {
                    productViewObj[key] = value;
                }
            } else {
                productViewObj = botData.product_view || {};
            }
            
            // Convert to array format
            // PERBAIKAN: value bisa berupa { id: [...] } atau langsung array
            const productViews = Object.entries(productViewObj).map(([title, value]) => ({
                title,
                productIds: Array.isArray(value?.id) ? value.id : (Array.isArray(value) ? value : [])
            }));
            
            res.json({ success: true, data: productViews });
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// POST: Menambahkan produk baru
app.post('/api/products', async (req, res) => {
    try {
        // Menggunakan "id" dari body yang akan dipetakan ke productId di fungsi db.addProduct
        const { id, name, price, desc } = req.body;
        if (!id || !name || !price) {
            return res.status(400).json({ success: false, error: 'ID, Name, dan Price diperlukan.' });
        }
        const result = await db.addProduct(BOT_ID, { id, name, price, desc });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// PUT: Mengedit produk yang ada
// Parameter: productId (sebelumnya :id)
app.put('/api/products/:productId', async (req, res) => {
    try {
        const { productId: oldId } = req.params; // Mengganti :id menjadi :productId
        const { newId, name, price, desc, snk } = req.body;
        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Name dan Price diperlukan.' });
        }

        let result;
        if (newId && newId !== oldId) {
            // Jika ID berubah, gunakan fungsi khusus yang mengupdate referensi
            result = await db.editProductId(BOT_ID, oldId, newId, { name, price, desc, snk });
        } else {
            // Menggunakan oldId sebagai productId
            result = await db.editProduct(BOT_ID, oldId, { name, price, desc, snk });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});


// DELETE: Menghapus produk
// Parameter: productId (sebelumnya :id)
app.delete('/api/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params; // Mengganti :id menjadi :productId
        const result = await db.delProduct(BOT_ID, productId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// POST: Menambahkan stok ke produk
// Parameter: productId (sebelumnya :id)
app.post('/api/products/:productId/stock', async (req, res) => {
    try {
        const { productId } = req.params; // Mengganti :id menjadi :productId
        const { accounts } = req.body;
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Data `accounts` (array) diperlukan.' });
        }
        // Menggunakan productId
        const result = await db.addStock(BOT_ID, productId, accounts);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// DELETE: Menghapus satu atau lebih akun stok dari produk
// Parameter: productId (sebelumnya :id)
app.delete('/api/products/:productId/stock', async (req, res) => {
    try {
        const { productId } = req.params; // Mengganti :id menjadi :productId
        const { accounts } = req.body;
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Data `accounts` (array) diperlukan.' });
        }
        // Menggunakan productId
        const result = await db.delStock(BOT_ID, productId, accounts);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// POST: Mengelola (membuat/update) Product View (Kategori)
app.post('/api/product-view', async (req, res) => {
    try {
        const { title, productIds } = req.body;
        if (!title || !productIds) {
            return res.status(400).json({ success: false, error: 'Title dan productIds diperlukan.' });
        }
        // productIds di body tetap menggunakan ID produk
        const result = await db.manageProductView(BOT_ID, title, productIds);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// DELETE: Menghapus seluruh kategori Product View
app.delete('/api/product-view/:title', async (req, res) => {
    try {
        const { title } = req.params;
        const result = await db.delProductView(BOT_ID, title);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// DELETE: Menghapus satu produk dari kategori Product View
app.delete('/api/product-view/:title/products/:productId', async (req, res) => {
    try {
        const { title, productId } = req.params;
        const result = await db.delIdFromProductView(BOT_ID, title, productId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error: ' + error.message });
    }
});

// GET: Halaman Riwayat Transaksi User atau Detail Transaksi
// Parameter: userId (sudah benar)
app.get('/trx', async (req, res) => {
    try {
        const { userId, ref_id } = req.query;

        if (!userId) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="id">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Error - Parameter Tidak Lengkap</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
                            color: #e6edf3;
                            padding: 20px;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .container {
                            max-width: 500px;
                            background: #161b22;
                            border-radius: 12px;
                            border: 1px solid #30363d;
                            padding: 50px 40px;
                            text-align: center;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                        }
                        h1 {
                            font-size: 1.6rem;
                            margin-bottom: 12px;
                            font-weight: 700;
                            color: #f85149;
                        }
                        p {
                            color: #8b949e;
                            margin-bottom: 30px;
                            font-size: 0.95rem;
                            line-height: 1.6;
                        }
                        .back-link {
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            color: #00a884;
                            background: rgba(0, 168, 132, 0.1);
                            border: 1px solid rgba(0, 168, 132, 0.2);
                            text-decoration: none;
                            font-weight: 600;
                            padding: 10px 16px;
                            border-radius: 8px;
                            transition: all 0.2s ease;
                            cursor: pointer;
                        }
                        .back-link:hover {
                            background: #00a884;
                            color: white;
                            border-color: #00a884;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Parameter Tidak Lengkap</h1>
                        <p>Parameter userId diperlukan untuk mengakses halaman ini. Silakan kembali ke dashboard.</p>
                        <a href="/" class="back-link">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Kembali ke Dashboard
                        </a>
                    </div>
                </body>
                </html>
            `);
        }

        // Jika ada ref_id, tampilkan detail transaksi spesifik
        if (ref_id) {
            const txResult = await db.getTransactionByRefId(ref_id);
            if (!txResult.success) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html lang="id" data-theme="dark">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Transaksi Tidak Ditemukan</title>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            :root {
                                --bg-primary: #0d1117;
                                --bg-secondary: #161b22;
                                --text-primary: #e6edf3;
                                --text-secondary: #8b949e;
                                --border-color: #30363d;
                                --accent-color: #00a884;
                                --accent-dark: #008e6f;
                                --danger-color: #f85149;
                            }
                            body {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
                                color: var(--text-primary);
                                padding: 20px;
                                min-height: 100vh;
                            }
                            .container {
                                max-width: 900px;
                                margin: 0 auto;
                                background: var(--bg-secondary);
                                border-radius: 12px;
                                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                                overflow: hidden;
                                border: 1px solid var(--border-color);
                            }
                            .error-content {
                                padding: 60px 40px;
                                text-align: center;
                            }
                            h1 { font-size: 1.8rem; color: var(--danger-color); margin-bottom: 12px; }
                            p { color: var(--text-secondary); margin-bottom: 30px; }
                            .back-link {
                                display: inline-flex;
                                align-items: center;
                                gap: 10px;
                                color: var(--accent-color);
                                background: rgba(255,255,255,0.03);
                                text-decoration: none;
                                font-weight: 600;
                                padding: 10px 14px;
                                border-radius: 10px;
                                transition: all 0.18s cubic-bezier(.2,.9,.2,1);
                                border: 1px solid rgba(255,255,255,0.06);
                                cursor: pointer;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                            }
                            .back-link:hover {
                                background: linear-gradient(90deg, var(--accent-color), var(--accent-dark));
                                color: white;
                                transform: translateY(-2px);
                                box-shadow: 0 10px 30px rgba(0,0,0,0.45);
                                border-color: transparent;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="error-content">
                                <h1>Transaksi Tidak Ditemukan</h1>
                                <p>Maaf, transaksi dengan ref_id '${ref_id}' tidak ditemukan.</p>
                                <a href="/trx?userId=${userId}" class="back-link">← Kembali ke Riwayat Transaksi</a>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            }

            const tx = txResult.data;
            const productResult = await db.dbBot(BOT_ID);
            const botData = productResult.data;

            // Konversi Map product menjadi Object
            let productObj = {};
            if (botData.product instanceof Map) {
                for (const [key, value] of botData.product) {
                    productObj[key] = value;
                }
            } else {
                productObj = botData.product || {};
            }

            const product = productObj[tx.productId];

            // product description and S&K intentionally omitted for a cleaner invoice-style view
            const accountsList = tx.accounts && tx.accounts.length > 0
                ? tx.accounts.map(acc => `<div class="account-item">${acc}</div>`).join('')
                : '<div class="empty-state">Tidak ada akun</div>';

            return res.send(`
                <!DOCTYPE html>
                <html lang="id" data-theme="dark">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Detail Transaksi</title>
                    <meta name="color-scheme" content="light">
                    <meta name="theme-color" content="#f4f5f7">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        /* FORCE LIGHT MODE */
                        :root {
                            color-scheme: light;
                        }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        :root {
                            --bg-primary: #f4f5f7;
                            --bg-secondary: #ffffff;
                            --text-primary: #18191c;
                            --text-secondary: #9499a0;
                            --border-color: #e3e5e7;
                            --accent-color: #00a1d6;
                            --accent-dark: #0091c2;
                            --success-color: #00c091;
                            --pending-color: #ffb027;
                        }
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            background: var(--bg-primary);
                            color: var(--text-primary);
                            padding: 24px;
                            line-height: 1.7;
                            min-height: 100vh;
                        }
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header-back {
                            margin-bottom: 20px;
                        }
                        .back-link {
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            color: var(--accent-color);
                            background: var(--bg-secondary);
                            text-decoration: none;
                            font-weight: 500;
                            font-size: 0.9rem;
                            padding: 10px 16px;
                            border-radius: 8px;
                            transition: all 0.15s ease;
                            border: 1px solid var(--border-color);
                        }
                        .back-link:hover {
                            background: #e3f6fc;
                            border-color: var(--accent-color);
                        }
                        .card {
                            background: var(--bg-secondary);
                            border-radius: 12px;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                            border: 1px solid var(--border-color);
                            overflow: hidden;
                            margin-bottom: 20px;
                        }
                        .card-header {
                            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-dark) 100%);
                            color: white;
                            padding: 24px 28px;
                        }
                        .card-header h1 {
                            font-size: 1.5rem;
                            margin-bottom: 6px;
                            font-weight: 600;
                        }
                        .card-header p {
                            color: rgba(255,255,255,0.85);
                            font-size: 0.9rem;
                        }
                        .card-content {
                            padding: 24px 28px;
                        }
                        .section {
                            margin-bottom: 28px;
                        }
                        .section:last-child {
                            margin-bottom: 0;
                        }
                        .section-title {
                            font-size: 0.9rem;
                            font-weight: 600;
                            color: var(--accent-color);
                            margin-bottom: 16px;
                            padding-bottom: 10px;
                            border-bottom: 1px solid var(--border-color);
                            text-transform: uppercase;
                            letter-spacing: 0.3px;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            gap: 12px;
                            margin-bottom: 20px;
                        }
                        .info-item {
                            background: #f9fafb;
                            padding: 16px;
                            border-radius: 8px;
                            border: 1px solid var(--border-color);
                        }
                        .info-label {
                            font-size: 0.75rem;
                            color: var(--text-secondary);
                            text-transform: uppercase;
                            letter-spacing: 0.4px;
                            margin-bottom: 6px;
                            font-weight: 500;
                        }
                        .info-value {
                            font-size: 1rem;
                            color: var(--text-primary);
                            font-weight: 600;
                        }
                        .status-badge {
                            display: inline-block;
                            padding: 5px 12px;
                            border-radius: 4px;
                            font-size: 0.75rem;
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.3px;
                        }
                        .status-badge.completed {
                            background: #e0f8f0;
                            color: var(--success-color);
                        }
                        .status-badge.pending {
                            background: #fff5e0;
                            color: #e09600;
                        }
                        /* Invoice / compact product card */
                        .product-info-card {
                            background: #f9fafb;
                            padding: 16px;
                            border-radius: 8px;
                            border: 1px solid var(--border-color);
                            margin-bottom: 16px;
                        }
                        .invoice-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            gap: 16px;
                            margin-bottom: 12px;
                        }
                        .invoice-title { font-size: 0.9rem; color: var(--text-secondary); font-weight: 600; }
                        .invoice-meta { text-align: right; color: var(--text-secondary); font-size: 0.85rem; }
                        .invoice-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                        .invoice-table th, .invoice-table td { padding: 10px 8px; text-align: left; font-size: 0.9rem; }
                        .invoice-table thead th { color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid var(--border-color); }
                        .invoice-table tbody tr { border-top: 1px solid var(--border-color); }
                        .invoice-total { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; align-items: baseline; }
                        .invoice-total .label { color: var(--text-secondary); font-size: 0.9rem; }
                        .invoice-total .amount { color: var(--accent-color); font-weight: 700; font-size: 1.1rem; }
                        .accounts-list {
                            display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                            gap: 10px;
                        }
                        .account-item {
                            background: #f9fafb;
                            padding: 12px 14px;
                            border-radius: 6px;
                            border: 1px solid var(--border-color);
                            font-family: 'Courier New', monospace;
                            font-size: 0.85rem;
                            word-break: break-all;
                            color: var(--text-primary);
                        }
                        .empty-state {
                            color: var(--text-secondary);
                            font-style: italic;
                            padding: 16px 0;
                            text-align: center;
                        }
                        .metadata {
                            background: #f9fafb;
                            padding: 16px;
                            border-radius: 8px;
                            margin-top: 16px;
                            border: 1px solid var(--border-color);
                        }
                        .metadata p {
                            color: var(--text-secondary);
                            font-size: 0.85rem;
                            margin: 6px 0;
                        }
                        @media (max-width: 768px) {
                            body { padding: 16px; }
                            .card-header { padding: 18px 20px; }
                            .card-header h1 { font-size: 1.2rem; }
                            .card-header p { font-size: 0.85rem; }
                            .card-content { padding: 18px 20px; }
                            .info-item { padding: 12px; }
                            .info-label { font-size: 0.7rem; }
                            .info-value { font-size: 0.9rem; }
                            .transaction-item { padding: 12px; gap: 8px; }
                            .transaction-product { font-size: 0.9rem; }
                            .transaction-meta { font-size: 0.75rem; gap: 8px; }
                            .transaction-amount { font-size: 0.95rem; }
                            .invoice-header { flex-direction: column; align-items: flex-start; gap: 8px; }
                            .invoice-meta { text-align: left; }
                            .invoice-table th, .invoice-table td { padding: 8px 6px; font-size: 0.85rem; }
                            .invoice-total .amount { font-size: 1rem; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header-back">
                            <a href="/trx?userId=${userId}" class="back-link">← Kembali ke Riwayat Transaksi</a>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h1>${tx.productName}</h1>
                                <p>Detail Transaksi #${tx.reffId}</p>
                            </div>
                            <div class="card-content">
                                <!-- Section 1: Informasi Transaksi -->
                                <div class="section">
                                    <div class="section-title">INFORMASI TRANSAKSI</div>
                                    <div class="info-grid">
                                        <div class="info-item">
                                            <div class="info-label">User ID</div>
                                            <div class="info-value">${tx.userId}</div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Tanggal</div>
                                            <div class="info-value">${new Date(tx.createdAt).toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Status</div>
                                            <div class="info-value"><span class="status-badge ${tx.status}">${tx.status === 'completed' ? 'Selesai' : 'Pending'}</span></div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Metode Pembayaran</div>
                                            <div class="info-value">${tx.paymentMethod || 'Balance'}</div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Quantity</div>
                                            <div class="info-value">${tx.quantity} Unit</div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Total Harga</div>
                                            <div class="info-value">Rp${Number(tx.totalAmount).toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Section 2: Informasi Produk -->
                                <div class="section">
                                    <div class="section-title">INFORMASI PRODUK</div>
                                    <div class="product-info-card">
                                            <div class="invoice-header">
                                                <div>
                                                    <div class="invoice-title">INVOICE</div>
                                                    <div style="font-weight:700; margin-top:6px;">${tx.productName}</div>
                                                </div>
                                                <div class="invoice-meta">
                                                    <div><strong>No:</strong> ${tx.reffId}</div>
                                                    <div><strong>Tanggal:</strong> ${new Date(tx.createdAt).toLocaleString('id-ID')}</div>
                                                    <div><strong>Metode:</strong> ${tx.paymentMethod || 'Balance'}</div>
                                                </div>
                                            </div>

                                            <table class="invoice-table">
                                                <thead>
                                                    <tr>
                                                        <th>Produk</th>
                                                        <th style="width:100px; text-align:right;">Harga</th>
                                                        <th style="width:80px; text-align:right;">Qty</th>
                                                        <th style="width:120px; text-align:right;">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>${tx.productName}</td>
                                                        <td style="text-align:right;">Rp${Number(tx.price).toLocaleString('id-ID')}</td>
                                                        <td style="text-align:right;">${tx.quantity}</td>
                                                        <td style="text-align:right;">Rp${Number(tx.totalAmount).toLocaleString('id-ID')}</td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            <div class="invoice-total">
                                                <div class="label">Total</div>
                                                <div class="amount">Rp${Number(tx.totalAmount).toLocaleString('id-ID')}</div>
                                            </div>
                                        </div>
                                </div>

                                <!-- Section 3: Akun yang Diterima -->
                                <div class="section">
                                    <div class="section-title">AKUN YANG DITERIMA</div>
                                    <div class="accounts-list">
                                        ${accountsList}
                                    </div>
                                </div>

                                <!-- Section 4: Metadata -->
                                <div class="section">
                                    <div class="section-title">METADATA TRANSAKSI</div>
                                    <div class="metadata">
                                        <p><strong>ID Transaksi:</strong> ${tx._id}</p>
                                        <p><strong>Ref ID:</strong> ${tx.reffId}</p>
                                        <p><strong>Bot ID:</strong> ${tx.botId}</p>
                                        <p><strong>Dibuat:</strong> ${new Date(tx.createdAt).toLocaleString('id-ID')}</p>
                                        ${tx.updatedAt ? `<p><strong>Terakhir Diupdate:</strong> ${new Date(tx.updatedAt).toLocaleString('id-ID')}</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        // Tampilkan daftar transaksi user
        const txResult = await db.getUserTransactionHistory(parseInt(userId), 0);
        if (!txResult.success) {
            return res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Error</title>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: sans-serif; background: #f5f5f5; padding: 20px; }
                        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; text-align: center; }
                        h1 { color: #e74c3c; }
                        a { color: #00a884; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Terjadi Kesalahan</h1>
                        <p>Gagal memuat transaksi: ${txResult.error}</p>
                        <a href="/">← Kembali ke Dashboard</a>
                    </div>
                </body>
                </html>
            `);
        }

        const transactions = txResult.data || [];

        res.send(`
            <!DOCTYPE html>
            <html lang="id" data-theme="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Riwayat Transaksi - User ${userId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="/style.css">
                <style>
                    /* Aesthetic upgrades for /trx list: softer card, sharper corners, emphasized status & method */
                    body { background: linear-gradient(135deg, #0d1117 0%, #161b22 100%); color: #e6edf3; font-family: 'Inter', sans-serif; }
                    .section-header h2 { display: flex; align-items: center; gap: 10px; }

                    /* Reduce card prominence: remove heavy background and shadow, smaller radius */
                    .card {
                        background: rgba(255,255,255,0.01); /* very subtle */
                        border: 1px solid rgba(255,255,255,0.02);
                        box-shadow: none;
                        border-radius: 8px; /* less rounded */
                        overflow: hidden;
                    }

                    .table-responsive { overflow-x: auto; }
                    .clean-table { width: 100%; border-collapse: collapse; }
                    .clean-table thead th {
                        background: linear-gradient(180deg, rgba(0,168,132,0.08), rgba(0,168,132,0.04));
                        color: #e6f6ef;
                        padding: 12px 14px;
                        text-align: left;
                        font-size: 0.85rem;
                        text-transform: uppercase;
                        letter-spacing: 0.6px;
                        border-bottom: 1px solid rgba(255,255,255,0.04);
                    }
                    /* Widget-specific tweaks to match 'Transaksi Terbaru' look */
                    .transactions-widget { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
                    .transactions-widget h2 { display:flex; align-items:center; gap:10px; margin:0; font-size:1.15rem; color:#e6f6ef; font-weight:700; }
                    .transactions-card { padding:6px 8px 10px 8px; background: rgba(255,255,255,0.01); border-radius:10px; }
                    .clean-table thead th:first-child { border-top-left-radius:10px; }
                    .clean-table thead th:last-child { border-top-right-radius:10px; }
                    .clean-table thead th { border-bottom: none; }
                    .clean-table tbody td { border-bottom: none; }
                    .clean-table tbody tr + tr td { border-top: 1px solid rgba(255,255,255,0.02); }
                    .clean-table tbody td {
                        padding: 12px 14px;
                        border-bottom: 1px solid rgba(255,255,255,0.02);
                        color: #dbeee5;
                        font-size: 0.95rem;
                    }

                    /* Emphasize status */
                    .status-badge {
                        display: inline-block;
                        padding: 6px 12px;
                        border-radius: 999px;
                        font-size: 0.8rem;
                        font-weight: 700;
                        text-transform: none;
                    }
                    .status-badge.completed { background: rgba(0,168,132,0.14); color: #00d38a; border: 1px solid rgba(0,168,132,0.18); }
                    .status-badge.pending { background: rgba(243,156,18,0.12); color: #f5b041; border: 1px solid rgba(243,156,18,0.14); }

                    /* Emphasize payment method */
                    .method-pill {
                        display: inline-block;
                        padding: 6px 10px;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.01);
                        border: 1px solid rgba(255,255,255,0.03);
                        color: #cfeee5;
                        font-weight: 600;
                        font-size: 0.85rem;
                        text-transform: capitalize;
                    }

                    /* Row hover subtle */
                    .clean-table tbody tr:hover { background: rgba(255,255,255,0.01); }

                    .text-center { text-align: center; }

                    @media (max-width: 768px) {
                        .clean-table thead th { font-size: 0.78rem; padding: 10px 8px; }
                        .clean-table tbody td { font-size: 0.82rem; padding: 10px 8px; }
                    }
                </style>
            </head>
            <body>
                <main class="container">
                    <section class="page active">
                        <div class="section-header transactions-widget">
                            <h2>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d38a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="21 13 21 7 15 7"></polyline></svg>
                                <span>Transaksi Terbaru</span>
                            </h2>
                        </div>

                        <div class="card transactions-card">
                            <div class="table-responsive">
                                <table class="clean-table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Produk</th>
                                            <th>User ID</th>
                                            <th>Qty</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                            <th>Metode</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${transactions.length === 0 ? `
                                            <tr><td colspan="7" class="text-center">Belum ada transaksi untuk user ini.</td></tr>
                                        ` : transactions.map(tx => `
                                            <tr onclick="window.location.href='/trx?userId=${userId}&ref_id=${tx.reffId}'" style="cursor:pointer;">
                                                <td>${new Date(tx.createdAt).toLocaleString('id-ID')}</td>
                                                <td>${tx.productName}</td>
                                                <td>${tx.userId}</td>
                                                <td>${tx.quantity}</td>
                                                <td>Rp${Number(tx.totalAmount).toLocaleString('id-ID')}</td>
                                                <td><span class="status-badge ${tx.status}">${tx.status === 'completed' ? 'Selesai' : 'Pending'}</span></td>
                                                <td><span class="method-pill">${tx.paymentMethod || 'Balance'}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </main>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: sans-serif; background: #f5f5f5; padding: 20px; }
                    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; text-align: center; }
                    h1 { color: #e74c3c; }
                    a { color: #00a884; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Terjadi Kesalahan</h1>
                    <p>Error: ${error.message}</p>
                    <a href="/">← Kembali ke Dashboard</a>
                </div>
            </body>
            </html>
        `);
    }
});

// GET: Melihat deskripsi produk
// Parameter: productId (sebelumnya :productId)
app.get('/deskripsi/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const result = await db.dbBot(BOT_ID);

        if (!result.success || !result.data) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Produk Tidak Ditemukan</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
                        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                        p { color: #666; }
                        a { color: #00a884; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Bot Tidak Ditemukan</h1>
                        <p>Maaf, produk yang Anda cari tidak tersedia.</p>
                        <a href="/">← Kembali ke Dashboard</a>
                    </div>
                </body>
                </html>
            `);
        }

        const botData = result.data;

        // Konversi Map product menjadi Object
        let productObj = {};
        if (botData.product instanceof Map) {
            for (const [key, value] of botData.product) {
                productObj[key] = value;
            }
        } else {
            productObj = botData.product || {};
        }

        // Menggunakan productId untuk mencari produk
        const product = productObj[productId];

        if (!product) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Produk Tidak Ditemukan</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
                        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                        p { color: #666; }
                        a { color: #00a884; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Produk Tidak Ditemukan</h1>
                        <p>Maaf, produk "${productId}" tidak tersedia.</p>
                        <a href="/">← Kembali ke Dashboard</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Return HTML page dengan deskripsi produk
        const desc = (product.desc || '').replace(/\n/g, '<br>');
        const snk = (product.snk || '').replace(/\n/g, '<br>');

        res.send(`
            <!DOCTYPE html>
            <html lang="id" data-theme="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${product.name} - Deskripsi Produk</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    :root {
                        --bg-primary: #f4f5f7;
                        --bg-secondary: #ffffff;
                        --text-primary: #18191c;
                        --text-secondary: #9499a0;
                        --border-color: #e3e5e7;
                        --accent-color: #00a1d6;
                        --accent-dark: #0091c2;
                    }
                    body { 
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
                        background: var(--bg-primary);
                        color: var(--text-primary);
                        padding: 24px;
                        line-height: 1.7;
                        min-height: 100vh;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        background: var(--bg-secondary);
                        border-radius: 12px; 
                        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
                        overflow: hidden;
                        border: 1px solid var(--border-color);
                    }
                    .header {
                        background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-dark) 100%);
                        color: white;
                        padding: 24px 28px;
                        text-align: center;
                    }
                    .header h1 {
                        font-size: 1.6rem;
                        margin-bottom: 6px;
                        font-weight: 600;
                        letter-spacing: -0.2px;
                    }
                    .content {
                        padding: 32px 28px;
                    }
                    .section {
                        margin-bottom: 32px;
                    }
                    .section:last-child {
                        margin-bottom: 0;
                    }
                    .section-title {
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: var(--accent-color);
                        margin-bottom: 14px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .section-content {
                        color: var(--text-primary);
                        font-size: 0.95rem;
                        line-height: 1.7;
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    .empty {
                        color: var(--text-secondary);
                        font-style: italic;
                    }
                    .footer {
                        background: #f9fafb;
                        padding: 20px 28px;
                        text-align: center;
                        border-top: 1px solid var(--border-color);
                    }
                    .back-link {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        color: var(--accent-color);
                        background: #ffffff;
                        text-decoration: none;
                        font-weight: 500;
                        padding: 10px 16px;
                        border-radius: 8px;
                        transition: all 0.15s ease;
                        border: 1px solid var(--border-color);
                        cursor: pointer;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    }
                    .back-link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; flex-shrink:0; }
                    .back-link span { display:inline-block; line-height:1; }
                    .back-link:hover {
                        background: #e3f6fc;
                        border-color: var(--accent-color);
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(0, 161, 214, 0.15);
                    }
                    .back-link:focus { outline: 2px solid rgba(0, 161, 214, 0.2); outline-offset: 2px; }
                    @media (max-width: 768px) {
                        .header { padding: 24px 16px; }
                        .header h1 { font-size: 1.5rem; }
                        .content { padding: 30px 20px; }
                        .section { margin-bottom: 30px; }
                        .section-title { font-size: 1.1rem; }
                        .section-content { font-size: 0.95rem; }
                        .footer { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${product.name}</h1>
                    </div>
                    
                    <div class="content">
                        <div class="section">
                            <div class="section-title">Deskripsi Produk</div>
                            <div class="section-content">${desc ? desc : '<span class="empty">Tidak ada deskripsi tersedia</span>'}</div>
                        </div>
                    </div>

                    <div class="footer">
                        <button id="back-btn" class="back-link" aria-label="Kembali">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15.5 19.5L8 12l7.5-7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                            <span>Kembali</span>
                        </button>
                    </div>
                </div>

                <script>
                    (function(){
                        var btn = document.getElementById('back-btn');
                        if (!btn) return;
                        btn.addEventListener('click', function(){
                            try {
                                window.open('','_self');
                                window.close();
                            } catch (e) {}
                            setTimeout(function(){
                                try { window.location.href = 'about:blank'; } catch(e){}
                                setTimeout(function(){
                                    try { alert('Jika halaman masih terbuka, silakan tutup browser secara manual.'); } catch(e){}
                                }, 250);
                            }, 300);
                        });
                    })();
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; background: #f4f5f7; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                    .container { max-width: 500px; width: 100%; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.04); border: 1px solid #e3e5e7; }
                    h1 { color: #f25d8e; margin-bottom: 16px; font-size: 1.5rem; }
                    p { color: #9499a0; margin-bottom: 24px; font-size: 0.95rem; }
                    a { color: #00a1d6; text-decoration: none; font-weight: 500; padding: 10px 20px; border-radius: 8px; background: #e3f6fc; display: inline-block; transition: all 0.2s; }
                    a:hover { background: #d0f0fa; transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Terjadi Kesalahan</h1>
                    <p>Maaf, terjadi kesalahan saat memproses permintaan Anda.</p>
                    <a href="/">← Kembali ke Dashboard</a>
                </div>
            </body>
            </html>
        `);
    }
});

// --- Serve Frontend ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- MENJALANKAN SERVER ---\
app.listen(PORT, async () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    // Pemanasan koneksi database saat server start
    try {
        await db.connectDB();
        console.log(`📡 Database terkoneksi untuk BOT_ID: ${BOT_ID}`);
    } catch (err) {
        console.error("⚠️ Gagal inisialisasi koneksi DB saat startup:", err.message);
    }
});
