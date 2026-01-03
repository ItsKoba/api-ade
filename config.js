import dotenv from "dotenv";

dotenv.config();

// MongoDB URL dari .env
global.url_mongodb = process.env.MONGODB_URL || "mongodb+srv://user:password@host/database";

// Bot ID dari .env
global.BOT_ID = parseInt(process.env.BOT_ID) || 0;

// Port dari .env
global.PORT = process.env.PORT || 3000;

// Password dari .env
global.PASSWORD = process.env.PASSWORD || "default";
