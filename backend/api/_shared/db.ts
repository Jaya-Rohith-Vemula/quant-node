import knex from "knex";
import type { Knex } from "knex";
import oracledb from "oracledb";
import "dotenv/config";
import path from "path";
import fs from "fs";

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

    // Resolve wallet path
    let walletPath = process.env.TNS_ADMIN;
    let useWallet = false;

    if (walletPath) {
        if (!path.isAbsolute(walletPath)) {
            walletPath = path.join(process.cwd(), walletPath);
        }
        useWallet = fs.existsSync(walletPath);
    } else {
        // Local dev fallback: check if Wallet folder exists
        const localWallet = path.join(process.cwd(), 'Wallet');
        if (fs.existsSync(localWallet)) {
            walletPath = localWallet;
            useWallet = true;
        }
    }

    const connectionConfig: any = {
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        connectString: process.env.DB_CONNECT_STRING!,
    };

    if (useWallet && walletPath) {
        connectionConfig.walletLocation = walletPath;
        connectionConfig.walletPassword = process.env.DB_PASSWORD!;
        console.log("Using Oracle Wallet at:", walletPath);
    } else {
        console.log("Using wallet-less (TLS) connection.");
    }

    persistentConn = await oracledb.getConnection(connectionConfig);
    console.log("Oracle connection established.");
    return persistentConn;
}

export async function closeConn() {
    if (persistentConn) {
        await persistentConn.close();
        persistentConn = null;
    }
}
