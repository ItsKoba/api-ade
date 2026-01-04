import "./config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import chalk from "chalk";

const url = global.url_mongodb;
let isConnected = false;

// --- 1. Konfigurasi Koneksi & Model Init ---

const connect = async () => {
  try {
    // Menambahkan dbName: "MannDB" sesuai permintaan
    await mongoose.connect(url, {
      dbName: "MannDB",
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });

    if (!isConnected) {
      isConnected = true;
      console.log(chalk.green("✓ Berhasil connect ke MongoDB (MannDB)"));
    }

    // Inisialisasi Model/Index agar siap digunakan
    await startInit();
    
  } catch (err) {
    console.log(chalk.red("x Gagal connect ke MongoDB:"), err);
    console.log(chalk.yellow("! Mencoba reconnect dalam 5 detik..."));
    setTimeout(connect, 5000);
  }
};

if (mongoose.connection.listeners("disconnected").length === 0) {
  mongoose.connection.on("disconnected", () => {
    console.log(chalk.red("x MongoDB terputus. Reconnecting..."));
    isConnected = false;
    connect();
  });
}

export async function connectDB() {
  // Jika belum connect, lakukan koneksi. 
  if (mongoose.connection.readyState !== 1) {
    await connect();
  }
}

export function getNativeDb() {
  return mongoose.connection.db;
}

// ----------------- Schema & Model Baru (Terpisah) -----------------

// 1. User Schema (Collection: users)
const userSchema = new mongoose.Schema(
  {
    // DIGANTI: id -> userId
    userId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, default: "No Name" },
    role: { type: String, default: "member" },
    balance: { type: Number, default: 0 },
    transaksi: { type: Number, default: 0 },
    membeli: { type: Number, default: 0 },
    isTelegram: { type: Boolean, default: true },
    total_nominal_transaksi: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 2. Bot Schema (Collection: bots)
const botSchema = new mongoose.Schema(
  {
    // DIGANTI: id -> botId
    botId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    terjual: { type: Number, default: 0 },
    transaksi: { type: Number, default: 0 },
    soldtoday: { type: Number, default: 0 },
    trxtoday: { type: Number, default: 0 },
    total_nominal_transaksi: { type: Number, default: 0 },
    nominaltoday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 3. Product Schema (Collection: products) - Berdiri sendiri
const productSchema = new mongoose.Schema(
  {
    botId: { type: Number, required: true, index: true }, // Referensi ke Bot
    // DIGANTI: id -> productId
    productId: { type: String, required: true, index: true },    // ID Produk (kode)
    name: { type: String, required: true },
    price: { type: Number, required: true },
    desc: { type: String, default: "" },
    snk: { type: String, default: "" },
    terjual: { type: Number, default: 0 },
    // Field 'account: [String]' DIHAPUS karena dipindah ke ProductStock
  },
  { timestamps: true }
);
// PERBAIKAN KRITIS: Compound index harus menggunakan productId
productSchema.index({ botId: 1, productId: 1 }, { unique: true });


// 7. ProductStock Schema (Collection: productstocks) - Skema Akun Stok Baru
const productStockSchema = new mongoose.Schema(
  {
    botId: { type: Number, required: true, index: true },
    productId: { type: String, required: true, index: true },
    // accountData: Berisi string "Email: example@gmail.com\nPassword: Login123"
    accountData: { type: String, required: true }, 
    isSold: { type: Boolean, default: false, index: true }, // Status stok: false (tersedia), true (terjual/terambil)
    
    // PERBAIKAN: Hapus 'index: true' dari sini agar tidak konflik dengan schema.index() di bawah
    trxRefId: { type: String, default: null }, 
  },
  { timestamps: true }
);
// Index Compound untuk pencarian cepat stok yang tersedia (isSold: false)
productStockSchema.index({ botId: 1, productId: 1, isSold: 1 }); 
// Index baru untuk pencarian cepat berdasarkan ID Transaksi (sparse agar mengabaikan dokumen dengan trxRefId=null)
// PERBAIKAN: Tambahkan nama unik untuk menghindari konflik dengan index lama di database
productStockSchema.index({ trxRefId: 1 }, { name: 'uniqueTrxRefId', sparse: true });


// 4. Category Schema (Collection: categories)
const categorySchema = new mongoose.Schema(
  {
    botId: { type: Number, required: true, index: true },
    name: { type: String, required: true }, // Nama Kategori
    // List ID Produk (yang kini berupa productId)
    products: [String], 
  },
  { timestamps: true }
);
categorySchema.index({ botId: 1, name: 1 }, { unique: true });

// 5. Transaction Schema (Collection: transactions) - Sudah benar
const transactionSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    botId: { type: Number, required: true, index: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    status: { type: String, default: "completed" },
    // accounts: [String], // DIHAPUS
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: "balance" },
    snk: { type: String, default: "" },
    reffId: { type: String, required: true, unique: true, index: true }, // Gunakan reffId sebagai kunci utama transaksi
  },
  { timestamps: true }
);

// 6. Auth User (Web)
const authUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, sparse: true },
    password: { type: String, required: true },
    telegramId: { type: Number, required: true, unique: true },
  },
  { timestamps: true }
);

authUserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

authUserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Export Models
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const Bot = mongoose.models.Bot || mongoose.model("Bot", botSchema);
export const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);
export const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
export const AuthUser = mongoose.models.AuthUser || mongoose.model("AuthUser", authUserSchema);
// Export Model ProductStock yang baru
export const ProductStock = mongoose.models.ProductStock || mongoose.model("ProductStock", productStockSchema);

export async function startInit() {
  await User.init();
  await Bot.init();
  await Product.init();
  await Category.init();
  await Transaction.init();
  await ProductStock.init(); // Init model baru
}

// ====================================================================
// =================== FORMATTER FUNCTIONS ============================
// ====================================================================

/**
 * Format user data untuk frontend - convert userId menjadi id
 */
function formatUserForFrontend(user) {
  if (!user) return null;
  return {
    ...user,
    id: user.userId  // Add id property dari userId
  };
}

/**
 * Format multiple users
 */
function formatUsersForFrontend(users) {
  return users.map(user => formatUserForFrontend(user));
}

// ====================================================================
// ================== FUNGSI CRUD (Telah Diperbaiki) ==================
// ====================================================================

// ----------------- Fungsi CRUD User -----------------
export async function userRegister(id, name) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan userId
    const exist = await User.findOne({ userId: id }); 
    if (exist) return { success: false, error: "ID sudah digunakan." };

    // PERBAIKAN: Gunakan userId
    const create = await User.create({ userId: id, name });
    return { success: true, data: create };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editBalance(id, amount) {
  await connectDB();
  try {
    if (!id || amount == null) throw new Error("Masukan data id dan amount!");
    if (isNaN(amount)) throw new Error("Nominal harus berupa angka!");

    // PERBAIKAN: Gunakan userId
    const update = await User.findOneAndUpdate(
      { userId: id },
      { $inc: { balance: amount } },
      { new: true }
    );

    if (!update) return { success: false, error: "ID tidak ditemukan." };
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editRole(id, role) {
  await connectDB();
  try {
    if (!id || !role) throw new Error("Masukan data id dan role!");

    // PERBAIKAN: Gunakan userId
    const update = await User.findOneAndUpdate(
      { userId: id },
      { $set: { role } },
      { new: true }
    );

    if (!update) return { success: false, error: "ID tidak ditemukan." };
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function checkUser(id) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan userId
    const exist = await User.findOne({ userId: id }).lean();
    return { success: true, data: !!exist };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function dbUser(id) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan userId
    const exist = await User.findOne({ userId: id });
    return { success: true, data: formatUserForFrontend(exist) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Alias untuk kompatibilitas dengan app.js
export async function getUserById(userId) {
  return await dbUser(userId);
}

// Update user data (role, name, balance)
export async function updateUserRoleAndBalance(userId, name, role, balance) {
  await connectDB();
  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (balance !== undefined) updates.balance = Number(balance);

    const updated = await User.findOneAndUpdate(
      { userId: Number(userId) },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return { success: false, error: "User tidak ditemukan." };
    }

    return { success: true, data: formatUserForFrontend(updated) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ----------------- Fungsi CRUD Bot -----------------
export async function checkDbBot(id) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const exist = await Bot.findOne({ botId: id }).lean();
    return { success: true, data: !!exist };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createDbBot(id, name) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const exist = await Bot.findOne({ botId: id });
    if (exist) return { success: false, error: "ID bot sudah terdaftar." };

    // PERBAIKAN: Gunakan botId
    const create = await Bot.create({ botId: id, name });
    return { success: true, data: create };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function dbBot(botId) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const bot = await Bot.findOne({ botId }).lean();
    if (!bot) return { success: false, message: "Bot not found" };

    const products = await Product.find({ botId }).lean();
    const categories = await Category.find({ botId }).lean();

    // Ambil semua stok yang tersedia (isSold: false)
    const allStock = await ProductStock.find({ botId, isSold: false })
        .select("productId accountData")
        .lean();
    
    // Hitung stok per produk dan group account data (include document _id to distinguish duplicates)
    const stockMap = {};
    const accountMap = {};
    allStock.forEach(stock => {
        if (!stockMap[stock.productId]) {
            stockMap[stock.productId] = 0;
            accountMap[stock.productId] = [];
        }
        stockMap[stock.productId]++;
        accountMap[stock.productId].push({ id: String(stock._id), accountData: stock.accountData });
    });

    // PERBAIKAN DATA RETURN: Mapping array products ke Object Map dengan stok dan account
    const productMap = {};
    products.forEach(p => {
        // Tambahkan stok dan account array untuk backward compatibility
        const productData = {
            ...p,
            id: p.productId,                              // Backward compatibility
            stock: stockMap[p.productId] || 0,            // Total stok tersedia
            account: accountMap[p.productId] || [],       // Daftar akun (backward compat)
        };
        productMap[p.productId] = productData;
    });

    // Mapping categories ke struktur lama product_view
    const viewMap = {};
    categories.forEach(c => {
        viewMap[c.name] = { id: c.products };
    });

    // Menggabungkan data virtual
    bot.product = new Map(Object.entries(productMap));
    bot.product_view = new Map(Object.entries(viewMap));

    return { success: true, data: bot };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ----------------- Fungsi CRUD Kategori (Category) -----------------
export async function createProductView(botId, title) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const botExists = await Bot.exists({ botId });
    if (!botExists) return { success: false, error: "Bot tidak ditemukan." };

    // Cek apakah kategori sudah ada
    const exist = await Category.findOne({ botId, name: title });
    if (exist) return { exist: true };

    // Buat Kategori Baru
    await Category.create({
        botId,
        name: title,
        products: []
    });

    return { success: true, data: { id: [] } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function addProductView(botId, title, accounts = []) {
  // NOTE: 'accounts' disini sebenarnya adalah array Product ID (productId)
  await connectDB();
  try {
    const category = await Category.findOne({ botId, name: title });
    if (!category)
      return {
        success: false,
        error: "Kategori tidak ditemukan.",
      };

    // Menggunakan $push sesuai behavior lama
    category.products.push(...accounts);
    await category.save();

    return { success: true, data: { id: category.products } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getCategory(botId) {
  await connectDB();
  try {
    const categories = await Category.find({ botId }).lean();
    
    // Format agar sesuai dengan return value kode lama (Object key-value)
    let data = {};
    for (let cat of categories) {
      data[cat.name] = cat.products;
    }
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Manage Product View (Create jika belum ada, atau update jika sudah ada)
 * @param {number} botId 
 * @param {string} title - Nama kategori
 * @param {string[]} productIds - Array product IDs
 */
export async function manageProductView(botId, title, productIds = []) {
  await connectDB();
  try {
    // Pastikan bot ada
    const botExists = await Bot.exists({ botId });
    if (!botExists) return { success: false, error: "Bot tidak ditemukan." };

    // Cek apakah kategori sudah ada
    let category = await Category.findOne({ botId, name: title });
    
    if (!category) {
      // Jika belum ada, buat kategori baru
      category = await Category.create({
        botId,
        name: title,
        products: productIds || []
      });
    } else {
      // Jika sudah ada, update dengan productIds baru
      category.products = productIds || [];
      await category.save();
    }

    return { success: true, data: { id: category.products } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ----------------- Fungsi CRUD Produk (Product) -----------------
export async function getProductDetails(botId, productId) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const product = await Product.findOne({ botId, productId }).lean();
    if (!product) return { success: false, error: "Produk tidak ditemukan." };

    // Tambahkan informasi stok (diambil dari ProductStock)
    const stockCount = await ProductStock.countDocuments({
        botId,
        productId,
        isSold: false
    });
    product.stock = stockCount;

    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fungsi untuk menambahkan stok akun ke koleksi ProductStock yang baru.
 * @param {number} botId 
 * @param {string} productId 
 * @param {string[]} accounts - Array string akun ("Email: X\nPassword: Y")
 */
export async function addStock(botId, productId, accounts = []) {
  await connectDB();
  try {
    // 1. Pastikan Produk ada
    const product = await Product.findOne({ botId, productId });
    if (!product) return { success: false, error: "Produk tidak ditemukan." };

    if (!Array.isArray(accounts) || accounts.length === 0) {
        return { success: false, error: "Daftar akun tidak valid atau kosong." };
    }

    // 2. Buat dokumen ProductStock untuk setiap akun
    const stockDocs = accounts.map(accountData => ({
        botId,
        productId,
        accountData, // Data akun dalam bentuk string
        isSold: false, // Default: tersedia
    }));
    
    // 3. Insert banyak dokumen sekaligus (Bulk Insert)
    const result = await ProductStock.insertMany(stockDocs); 

    // 4. Hitung total stok yang tersedia sekarang untuk product ini
    const totalStock = await ProductStock.countDocuments({
        botId,
        productId,
        isSold: false
    });

    // 5. Return data yang lengkap dengan updated product info
    return { 
      success: true, 
      data: { 
        insertedCount: result.length,
        productId,
        name: product.name,
        totalStock
      } 
    };
  } catch (err) {
    console.error("❌ Gagal menambahkan stok:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Menghapus satu atau beberapa akun stok untuk suatu produk berdasarkan array accountData
 * @param {number} botId
 * @param {string} productId
 * @param {string[]} accounts - Array string akun yang akan dihapus (harus cocok dengan field accountData)
 */
export async function delStock(botId, productId, accounts = []) {
  await connectDB();
  try {
    // Validasi produk
    const product = await Product.findOne({ botId, productId }).lean();
    if (!product) return { success: false, error: "Produk tidak ditemukan." };

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { success: false, error: "Daftar akun tidak valid atau kosong." };
    }

    // Basic validation for each account string
    const cleanedAccounts = accounts
      .map(a => (typeof a === 'string' ? a.trim() : ''))
      .filter(a => a.length > 0);

    if (cleanedAccounts.length === 0) {
      return { success: false, error: "Daftar akun tidak valid atau kosong setelah pembersihan." };
    }

    // Prevent overly long account strings (possible abuse)
    if (cleanedAccounts.some(a => a.length > 2000)) {
      return { success: false, error: "Salah satu akun terlalu panjang." };
    }

    // Limit bulk deletion to avoid accidental massive removals
    if (cleanedAccounts.length > 200) {
      return { success: false, error: "Permintaan menghapus terlalu banyak item sekaligus (maks 200)." };
    }

    // Support mixed deletion (some items may be _id and some may be raw accountData strings)
    const ids = cleanedAccounts.filter(a => /^[a-fA-F0-9]{24}$/.test(a));
    const strings = cleanedAccounts.filter(a => !/^[a-fA-F0-9]{24}$/.test(a));

    let deleteFilter;
    if (ids.length && strings.length) {
      deleteFilter = {
        botId,
        productId,
        $or: [
          { _id: { $in: ids.map(a => new mongoose.Types.ObjectId(a)) } },
          { accountData: { $in: strings } }
        ],
        isSold: false
      };
    } else if (ids.length) {
      deleteFilter = {
        botId,
        productId,
        _id: { $in: ids.map(a => new mongoose.Types.ObjectId(a)) },
        isSold: false
      };
    } else {
      deleteFilter = {
        botId,
        productId,
        accountData: { $in: strings },
        isSold: false
      };
    }

    const deleteResult = await ProductStock.deleteMany(deleteFilter);

    // Ambil sisa akun yang tersedia (untuk ditampilkan di frontend) - sertakan _id agar duplicates tetap dianggap terpisah
    const remainingAccountsDocs = await ProductStock.find({ botId, productId, isSold: false })
      .select('accountData')
      .lean();

    const accountArr = remainingAccountsDocs.map(d => ({ id: String(d._id), accountData: d.accountData }));

    // Hitung sisa stok yang tersedia untuk product ini
    const totalStock = accountArr.length;

    // Buat objek product yang sesuai dengan struktur frontend
    const productObj = {
      productId: product.productId,
      id: product.productId,
      name: product.name,
      price: product.price,
      desc: product.desc,
      snk: product.snk,
      terjual: product.terjual || 0,
      stock: totalStock,
      account: accountArr,
      deletedCount: deleteResult.deletedCount || 0,
      requestedDeleted: cleanedAccounts.length
    };

    // Safety check & informational message if counts mismatch
    if (productObj.deletedCount !== cleanedAccounts.length) {
      console.warn(`Hapus stok: permintaan ${cleanedAccounts.length} items, berhasil dihapus ${productObj.deletedCount}`);
    }

    return {
      success: true,
      data: productObj
    };
  } catch (err) {
    console.error("❌ Gagal menghapus stok:", err);
    return { success: false, error: err.message };
  }
}

export async function delProduct(botId, productId) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const result = await Product.deleteOne({ botId, productId });
    if (result.deletedCount === 0)
      return { success: false, error: "Produk tidak ditemukan." };

    // Hapus juga stok akun yang terkait dari ProductStock
    await ProductStock.deleteMany({ botId, productId });

    // Hapus juga referensi produk ini dari semua Kategori milik bot tersebut
    await Category.updateMany(
        { botId },
        { $pull: { products: productId } }
    );

    return { success: true, data: `Produk ${productId} berhasil dihapus.` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editProductName(botId, productId, newName) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const product = await Product.findOneAndUpdate(
        { botId, productId },
        { name: newName },
        { new: true }
    );
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editProductPrice(botId, productId, newPrice) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const product = await Product.findOneAndUpdate(
        { botId, productId },
        { price: Number(newPrice) },
        { new: true }
    );
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editProductDesk(botId, productId, newDesc) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const product = await Product.findOneAndUpdate(
        { botId, productId },
        { desc: newDesc },
        { new: true }
    );
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editProductSnk(botId, productId, newSnk) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan productId
    const product = await Product.findOneAndUpdate(
        { botId, productId },
        { snk: newSnk },
        { new: true }
    );
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Edit product dengan multiple fields (name, price, desc, snk)
 * @param {number} botId 
 * @param {string} productId 
 * @param {object} updates - Object berisi { name, price, desc, snk }
 */
export async function editProduct(botId, productId, updates = {}) {
  await connectDB();
  try {
    const updateData = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.price !== undefined) updateData.price = Number(updates.price);
    if (updates.desc !== undefined) updateData.desc = updates.desc;
    if (updates.snk !== undefined) updateData.snk = updates.snk;

    const product = await Product.findOneAndUpdate(
        { botId, productId },
        { $set: updateData },
        { new: true }
    );

    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function editProductID(botId, oldId, newId) {
  await connectDB();
  try {
    // 1. Cek ID baru
    const checkNew = await Product.findOne({ botId, productId: newId });
    if (checkNew) return { success: false, error: "ID baru sudah digunakan." };

    // 2. Update ID di Product
    const product = await Product.findOneAndUpdate(
        { botId, productId: oldId },
        { productId: newId },
        { new: true }
    );
    if (!product) return { success: false, error: "Produk tidak ditemukan." };

    // 3. Update ID di ProductStock
    await ProductStock.updateMany(
        { botId, productId: oldId },
        { $set: { productId: newId } }
    );

    // 4. Update referensi di Kategori
    const cats = await Category.find({ botId, products: oldId });
    for(let cat of cats) {
        const idx = cat.products.indexOf(oldId);
        if(idx !== -1) {
            cat.products[idx] = newId;
            await cat.save();
        }
    }

    return { success: true, data: product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengambil daftar akun yang tersedia (TIDAK UNTUK TRANSAKSI, hanya untuk tampilan/debugging).
 * @param {number} botId 
 * @param {string} productId 
 * @param {number} total 
 */
export async function getProductAccount(botId, productId, total = 1) {
  await connectDB();
  try {
    // Ambil akun yang belum terjual dari ProductStock
    const accounts = await ProductStock.find({ 
        botId, 
        productId,
        isSold: false
    })
    .select("accountData") // Hanya ambil field accountData
    .limit(total)
    .lean();

    // Mapping hasilnya menjadi array of strings (sesuai format return lama)
    const accountStrings = accounts.map(doc => doc.accountData);
    
    return { success: true, data: accountStrings };
  } catch (err) {
    console.error("❌ Gagal mengambil daftar akun:", err);
    return { success: false, error: err.message };
  }
}

export async function getProductList(botId) {
  await connectDB();
  try {
    const products = await Product.find({ botId }).lean();
    
    // Ambil semua stok yang tersedia untuk bot ini
    const allStock = await ProductStock.find({ botId, isSold: false })
        .select("productId")
        .lean();
    
    // Hitung stok per produk
    const stockMap = allStock.reduce((acc, stock) => {
        acc[stock.productId] = (acc[stock.productId] || 0) + 1;
        return acc;
    }, {});

    // Gabungkan data produk dengan jumlah stok
    const list = products.map((p) => {
        const stockCount = stockMap[p.productId] || 0;
        return {
            productId: p.productId,
            name: p.name,
            price: p.price,
            desc: p.desc,
            snk: p.snk,
            stock: stockCount, // Menggunakan perhitungan dari ProductStock
            terjual: p.terjual,
        };
    });

    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fungsi krusial untuk mengambil stok. Menggunakan findOneAndUpdate secara atomik.
 * @param {number} botId 
 * @param {string} productId 
 * @param {number} total 
 * @param {string} trxRefId - ID Referensi Transaksi untuk mencatat siapa yang mengambil stok.
 */
export async function takeProductAccount(botId, productId, total = 1, trxRefId = null) {
  await connectDB();
  try {
    if (!trxRefId) {
        // Seharusnya trxRefId selalu ada saat pembelian
        throw new Error("trxRefId wajib disertakan saat pengambilan stok."); 
    }

    const takenAccounts = [];
    
    // Loop untuk mengambil 'total' akun secara aman
    for(let i = 0; i < total; i++) {
        // Cari 1 dokumen ProductStock yang belum terjual (isSold: false)
        // dan langsung update menjadi terjual (isSold: true)
        const accountDoc = await ProductStock.findOneAndUpdate(
            { botId, productId, isSold: false },
            { $set: { isSold: true, trxRefId: trxRefId } }, // <<== PERBAIKAN: Tambahkan trxRefId
            { new: true, sort: { createdAt: 1 } } // Ambil yang paling lama/pertama
        );

        if (!accountDoc) {
            // Jika stok tidak cukup, batalkan operasi dan kembalikan stok yang mungkin sudah terambil
            if (takenAccounts.length > 0) {
                // Mengembalikan (undo) status isSold=true menjadi isSold=false dan hapus trxRefId
                await ProductStock.updateMany(
                    { trxRefId: trxRefId, isSold: true }, // Cari berdasarkan trxRefId
                    { $set: { isSold: false, trxRefId: null } }
                );
            }
            return { success: false, error: "Stok tidak mencukupi untuk jumlah yang diminta." };
        }
        takenAccounts.push(accountDoc.accountData);
    }
    
    // Mengembalikan data akun yang diambil dan trxRefId yang digunakan (untuk kemudahan log)
    return { success: true, data: takenAccounts, trxRefId: trxRefId }; 
  } catch (err) {
    console.error("❌ Gagal saat mengambil stok akun (takeProductAccount):", err);
    return { success: false, error: err.message };
  }
}

// ----------------- Fungsi Admin (Disesuaikan) -----------------

export async function addProduct(botId, productData) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const botExists = await Bot.exists({ botId });
    if (!botExists) return { success: false, error: "Bot tidak ditemukan." };

    // PERBAIKAN: Cek produk menggunakan productId
    const checkProduct = await Product.exists({ botId, productId: productData.id });
    if (checkProduct) {
      return { success: false, error: "ID produk sudah ada." };
    }

    // PERBAIKAN: Simpan menggunakan productId (tanpa field account)
    const newProduct = await Product.create({
      botId: botId,
      productId: productData.id,
      name: productData.name,
      price: productData.price,
      desc: productData.desc || "",
      snk: productData.snk || "",
      terjual: 0,
    });

    return { success: true, data: newProduct };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteProduct(botId, productId) {
    // Sama dengan delProduct, sudah diperbarui untuk menghapus ProductStock
    return await delProduct(botId, productId);
}

/**
 * Fungsi untuk admin/importer stok. Digunakan addStock yang baru.
 */
export async function addProductStock(botId, productId, accounts) {
    const res = await addStock(botId, productId, accounts);
    if(res.success) {
        // Hitung total stok yang tersedia saat ini untuk dikembalikan ke Admin
        const stockCount = await ProductStock.countDocuments({
            botId,
            productId,
            isSold: false
        });
        return { success: true, data: { stock: stockCount } };
    }
    return res;
}

// Add category (Admin version)
export async function addCategory(botId, categoryName, productIds) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const botExists = await Bot.exists({ botId });
    if (!botExists) return { success: false, error: "Bot tidak ditemukan." };

    const exist = await Category.exists({ botId, name: categoryName });
    if (exist) {
      return { success: false, error: "Kategori sudah ada." };
    }

    await Category.create({
        botId,
        name: categoryName,
        products: productIds
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Update category (Sudah benar)
export async function updateCategory(botId, categoryName, productIds) {
  await connectDB();
  try {
    const category = await Category.findOneAndUpdate(
        { botId, name: categoryName },
        { products: productIds },
        { new: true }
    );

    if (!category) {
      return { success: false, error: "Kategori tidak ditemukan." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Delete category (Sudah benar)
export async function deleteCategory(botId, categoryName) {
  await connectDB();
  try {
    const res = await Category.deleteOne({ botId, name: categoryName });
    
    if (res.deletedCount === 0) {
      return { success: false, error: "Kategori tidak ditemukan." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Alias untuk deleteCategory - digunakan oleh app.js endpoint DELETE /api/product-view/:title
 * @param {number} botId 
 * @param {string} title - Nama kategori
 */
export async function delProductView(botId, title) {
  return await deleteCategory(botId, title);
}

/**
 * Menghapus satu produk dari kategori Product View
 * @param {number} botId 
 * @param {string} title - Nama kategori
 * @param {string} productId - ID produk yang akan dihapus dari kategori
 */
export async function delIdFromProductView(botId, title, productId) {
  await connectDB();
  try {
    const category = await Category.findOne({ botId, name: title });
    if (!category) {
      return { success: false, error: "Kategori tidak ditemukan." };
    }

    // Remove productId from products array
    const index = category.products.indexOf(productId);
    if (index === -1) {
      return { success: false, error: "Produk tidak ditemukan dalam kategori ini." };
    }

    category.products.splice(index, 1);
    await category.save();

    return { success: true, data: { id: category.products } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ----------------- Statistik & Lainnya (Disesuaikan) -----------------

export async function getAdminStats(botId) {
  await connectDB();
  try {
    const totalUsers = await User.countDocuments({});
    const totalTransactions = await Transaction.countDocuments({ botId });
    
    // PERBAIKAN: Gunakan botId
    const bot = await Bot.findOne({ botId });
    if (!bot) return { success: false, error: "Bot tidak ditemukan." };

    // Hitung total produk dari collection Product
    const totalProducts = await Product.countDocuments({ botId });

    const totalRevenue = bot.total_nominal_transaksi || 0;
    const totalProductsSold = bot.terjual || 0;

    return {
      success: true,
      data: {
        totalUsers,
        totalTransactions,
        totalProducts,
        totalRevenue,
        totalProductsSold,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Fungsi recordSale perlu update karena produk terpisah
export async function recordSale(botId, productCode, quantity, finalPrice) {
  try {
    // 1. Update di Collection Product
    // PERBAIKAN: Gunakan productId
    await Product.updateOne(
        { botId, productId: productCode },
        { $inc: { terjual: quantity } } 
    );

    // 2. Update Statistik Bot Utama
    // PERBAIKAN: Gunakan botId
    const botData = await Bot.findOne({ botId });
    if (botData) {
        botData.terjual = (botData.terjual || 0) + quantity;
        botData.soldtoday = (botData.soldtoday || 0) + quantity;
        botData.trxtoday = (botData.trxtoday || 0) + finalPrice;
        await botData.save();
    }
  } catch (dbError) {
    console.error("Gagal memperbarui statistik penjualan:", dbError);
  }
}

export async function addProductSold(botId, productId, totalTerjual) {
  await connectDB();
  try {
    // PERBAIKAN: Update total terjual di Bot menggunakan botId
    await Bot.findOneAndUpdate(
        { botId },
        { $inc: { terjual: totalTerjual } }
    );

    // PERBAIKAN: Update terjual di Product spesifik menggunakan productId
    const updatedProduct = await Product.findOneAndUpdate(
        { botId, productId },
        { $inc: { terjual: totalTerjual } },
        { new: true }
    );

    if (!updatedProduct)
      return {
        success: false,
        error: "Produk tidak ditemukan.",
      };

    return { success: true, data: updatedProduct };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getDBData(fn, ...args) {
  try {
    const result = await fn(...args);
    if (!result.success) throw new Error(result.message);
    return result.data;
  } catch (e) {
    console.error("Error database :\n" + e);
    return null;
  }
}

export async function getAllUsers() {
  await connectDB();
  try {
    const users = await User.find({}).select("-__v").lean();
    return { success: true, data: formatUsersForFrontend(users) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteUser(userId) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan userId
    const user = await User.findOneAndDelete({ userId });
    if (!user) return { success: false, error: "User tidak ditemukan." };
    await AuthUser.deleteOne({ telegramId: userId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getTransactionHistory(botId, limit = 0) {
  await connectDB();
  try {
    const query = Transaction.find({ botId }).sort({ createdAt: -1 });
    if (limit > 0) {
      query.limit(limit);
    }
    const transactions = await query.lean();
    return { success: true, data: transactions };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getAllTransactions(botId) {
  await connectDB();
  try {
    const transactions = await Transaction.find({ botId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return { success: true, data: transactions };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getPublicStats(botId) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const bot = await Bot.findOne({ botId });
    if (!bot) return { success: false, error: "Bot tidak ditemukan." };
    const totalRevenue = bot.total_nominal_transaksi || 0;
    const totalProductsSold = bot.terjual || 0;
    return {
      success: true,
      data: { totalRevenue, totalProductsSold },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengambil detail transaksi berdasarkan ID Referensi dan mengambil data akun terkait
 * dari koleksi ProductStock.
 * @param {string} reffId - ID Referensi Transaksi
 */
export async function getTransactionDetails(reffId) {
    await connectDB();
    try {
        const transaction = await Transaction.findOne({ reffId }).lean();
        if (!transaction) {
            return { success: false, error: "Transaksi tidak ditemukan." };
        }

        // PERBAIKAN KRITIS: Ambil akun dari ProductStock menggunakan trxRefId
        const soldAccounts = await ProductStock.find({ trxRefId: reffId })
            .select("accountData")
            .lean();
        
        // Gabungkan data akun ke dalam objek transaksi untuk kompatibilitas
        transaction.accounts = soldAccounts.map(doc => doc.accountData);
        
        return { success: true, data: transaction };
    } catch (err) {
        console.error("❌ Gagal mengambil detail transaksi:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Alias untuk getTransactionDetails() - mencari transaksi berdasarkan reffId
 * (fungsi ini dipanggil dari app.js di endpoint transaction detail)
 * @param {string} reffId - ID Referensi Transaksi
 */
export async function getTransactionByRefId(reffId) {
    return await getTransactionDetails(reffId);
}


export async function addTransactionHistory(
  userId, botId, productId, productName, quantity, price,
  // accounts, // PERBAIKAN: accounts dihilangkan dari parameter, karena akan diambil dari ProductStock
  status = "completed", paymentMethod = "balance",
  snk = "", reffId
) {
  await connectDB();
  try {
    // Pastikan reffId ada dan unik
    if (!reffId) throw new Error("reffId wajib disertakan.");
      
    const totalAmount = price * quantity;
    
    // Periksa apakah reffId sudah digunakan (ini penting)
    const existingTrx = await Transaction.exists({ reffId });
    if (existingTrx) {
        throw new Error(`Transaksi dengan reffId ${reffId} sudah ada.`);
    }

    // accounts DIHILANGKAN dari dokumen Transaction
    const newTransaction = await Transaction.create({
      userId, botId, productId, productName, quantity, price,
      status, totalAmount, paymentMethod, snk, reffId,
    });
    return { success: true, data: newTransaction };
  } catch (err) {
    console.error("❌ Gagal mencatat riwayat transaksi:", err);
    return { success: false, error: err.message };
  }
}

export async function getUserTransactionHistory(userId, limit = 10, skip = 0) {
  await connectDB();
  try {
    // PERBAIKAN: Di sini hanya mengembalikan data dasar, jika detail akun diperlukan,
    // perlu dilakukan pemanggilan getTransactionDetails
    const history = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    return { success: true, data: history };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getBotGlobalTransactionHistory(botId, limit = 10, skip = 0) {
  await connectDB();
  try {
    const history = await Transaction.find({ botId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    return { success: true, data: history };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function addBotTransactionDetailed(
  botId, totalTransaksi, totalTerjual, totalSoldToday,
  totalTrxToday, nominalLifetime, nominalToday
) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const update = await Bot.findOneAndUpdate(
      { botId },
      {
        $inc: {
          transaksi: totalTransaksi,
          terjual: totalTerjual,
          soldtoday: totalSoldToday,
          trxtoday: totalTrxToday,
          total_nominal_transaksi: nominalLifetime,
          nominaltoday: nominalToday,
        },
      },
      { new: true }
    );
    if (!update) return { success: false, error: "ID Bot tidak ditemukan." };
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function addBotTransaction(botId, totalTransaksi = 1, totalNominal = 0) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan botId
    const update = await Bot.findOneAndUpdate(
      { botId },
      {
        $inc: {
          transaksi: totalTransaksi,
          total_nominal_transaksi: totalNominal,
        },
      },
      { new: true }
    );
    if (!update) return { success: false, error: "ID Bot tidak ditemukan." };
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function calculateTotalRevenue() {
  await connectDB();
  try {
    const result = await Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    return result[0]?.total || 0;
  } catch (err) {
    return 0;
  }
}

export async function getRevenueByDate(startDate, endDate) {
  await connectDB();
  try {
    const result = await Transaction.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    return result[0]?.total || 0;
  } catch (err) {
    return 0;
  }
}

export async function calculateTotalPcs() {
  await connectDB();
  try {
    const result = await Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, totalPcs: { $sum: "$quantity" } } },
    ]);
    return result[0]?.totalPcs || 0;
  } catch (err) {
    return 0;
  }
}

export async function getPcsPerProduk() {
  await connectDB();
  try {
    const result = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$productId",
          productName: { $first: "$productName" },
          totalPcs: { $sum: "$quantity" },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalPcs: -1 } },
    ]);
    return result;
  } catch (err) {
    return [];
  }
}

export async function getPcsTerjualPerProduk(productId) {
  await connectDB();
  try {
    const result = await Transaction.aggregate([
      { $match: { status: "completed", productId } },
      { $group: { _id: "$productId", totalPcs: { $sum: "$quantity" } } },
    ]);
    return result[0]?.totalPcs || 0;
  } catch (err) {
    return 0;
  }
}

export async function addUserTransaction(userId, totalTransaksi, totalMembeli, nominal) {
  await connectDB();
  try {
    // PERBAIKAN: Gunakan userId
    const update = await User.findOneAndUpdate(
      { userId },
      {
        $inc: {
          transaksi: totalTransaksi,
          membeli: totalMembeli,
          total_nominal_transaksi: nominal,
        },
      },
      { new: true }
    );
    if (!update) return { success: false, error: "ID User tidak ditemukan." };
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Fungsi internal helper
async function pcsPerProdukDariTransaksi(botId) {
  await connectDB();
  const hasil = await Transaction.aggregate([
    { $match: { status: "completed", botId } },
    {
      $group: {
        _id: "$productId",
        namaProduk: { $first: "$productName" },
        totalPcs: { $sum: "$quantity" },
        totalPendapatan: { $sum: "$totalAmount" },
      },
    },
    { $sort: { totalPcs: -1 } },
  ]);
  return hasil;
}

export async function totalTransaksi(botId) {
  try {
    let data = await pcsPerProdukDariTransaksi(botId);
    let totalPcs = 0;
    let totalPendapatan = 0;
    data.forEach((item) => {
      totalPcs += item.totalPcs;
      totalPendapatan += item.totalPendapatan;
    });
    return { totalPcs, totalPendapatan };
  } catch (e) {
    console.log("Gagal menghitung total transaksi:", e);
    return { totalPcs: 0, totalPendapatan: 0 };
  }
}

export async function getTelegramUsers() {
  try {
    await connectDB();
    let data = await User.find({ isTelegram: true });
    return data;
  } catch (error) {
    console.error("Error fetching Telegram users:", error);
    return [];
  }
}

export async function getProdukPopuler(botId, limit = 10) {
  await connectDB();
  try {
    const topProducts = await Transaction.aggregate([
      { $match: { botId: botId, status: "completed" } },
      {
        $group: {
          _id: "$productId",
          productName: { $first: "$productName" },
          totalSold: { $sum: "$quantity" },
          totalRevenue: { $sum: "$totalAmount" },
          lastTransaction: { $max: "$createdAt" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
    ]);
    return { success: true, data: topProducts };
  } catch (err) {
    console.error("❌ Gagal mengambil produk populer:", err);
    return { success: false, error: err.message };
  }
}
