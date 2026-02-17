import knex from "knex";
import type { Knex } from "knex";
import oracledb from "oracledb";
import "dotenv/config";
import path from "path";

const dbConfig: any = {
    client: "oracledb",
};

export const db: Knex = knex(dbConfig);
(db.client as any).driver = oracledb;

// Performance tuning for large data sets
oracledb.fetchArraySize = 10000;
oracledb.prefetchRows = 10000;
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let persistentConn: any = null;

export async function getConn() {
    if (persistentConn) {
        try {
            // Check if connection is still alive
            await persistentConn.execute('SELECT 1 FROM DUAL');
            return persistentConn;
        } catch (err) {
            console.log("Persistent connection lost, reconnecting...");
            persistentConn = null;
        }
    }

    console.log("Opening new Oracle connection...");

    // Resolve wallet path: prefer env var, fallback to local Wallet folder
    let walletPath = process.env.TNS_ADMIN;
    if (!walletPath) {
        walletPath = path.join(process.cwd(), 'Wallet');
    } else if (!path.isAbsolute(walletPath)) {
        walletPath = path.join(process.cwd(), walletPath);
    }

    persistentConn = await oracledb.getConnection({
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        connectString: process.env.DB_CONNECT_STRING!,
        walletLocation: walletPath,
        walletPassword: process.env.DB_PASSWORD!,
    });
    console.log("Oracle connection established with wallet at:", walletPath);
    return persistentConn;
}

export async function closeConn() {
    if (persistentConn) {
        await persistentConn.close();
        persistentConn = null;
    }
}
