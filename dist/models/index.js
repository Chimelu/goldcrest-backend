"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const user_1 = require("./user");
const dbUrl = process.env.DATABASE_URL;
exports.sequelize = dbUrl
    ? new sequelize_1.Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    })
    : new sequelize_1.Sequelize(process.env.DB_NAME || 'goldcrest', process.env.DB_USER || 'postgres', process.env.DB_PASSWORD || '', {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    });
exports.User = (0, user_1.UserFactory)(exports.sequelize);
