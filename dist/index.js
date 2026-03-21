"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const models_1 = require("./models");
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/auth', auth_1.default);
async function start() {
    try {
        await models_1.sequelize.authenticate();
        console.log('Database connected successfully');
        // Adds new columns (e.g. isVerified) when models change; set DB_SYNC_ALTER=false to skip
        await models_1.sequelize.sync({ alter: process.env.DB_SYNC_ALTER !== 'false' });
        console.log('Database models synced');
        app.listen(port, '0.0.0.0', () => {
            console.log(`API listening on port ${port} (reachable at http://localhost:${port} on this machine)`);
        });
    }
    catch (err) {
        console.error('Failed to start server', err);
        process.exit(1);
    }
}
start();
